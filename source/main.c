#define SDL_MAIN_HANDLED
#include <SDL2/SDL.h>
#include <SDL2/SDL_ttf.h>
#include <glad/glad.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include "c_math.h"
#include "defines.h"

static void handle_key_event(SDL_Keycode k, SDL_Keymod m, SDL_Window *window);
static void toggle_mouse();
static void toggle_fullscreen(SDL_Window *w);
static void update_movement(const uint8_t *keys, float dt);
static void init_globals();
static void reset_camera();
static void set_level(int level_id);
static void calculate_flag_radius();
static void build_light_camera(vec3_t scene_center, float light_distance);
static void create_objects();
static void load_sparse_raymarch();
static void load_sparse_shadow_raymarch();
static void load_draw_depth();
static void setup_static_uniforms();
static void dispatch_sparse_raymarch();
static void dispatch_sparse_shadow_raymarch();
static void dispatch_draw_depth();
static void load_ui_text();
static void load_full_raymarch();
static void dispatch_ui_text();
static void dispatch_full_raymarch();
static void check_shader_compile(uint32_t shader, const char *name);
static char* load_text_file(const char *path);
static void update_debug_text(const char *str);
static void print_debug();
void GLAPIENTRY MessageCallback(GLenum source, GLenum type, uint32_t id, GLenum severity, GLsizei length, const GLchar* message, const void* userParam);

static int start_paused;
static int paused;
static int running;
static int fullscreen;
static int mouse_captured;
static int draw_debug;
static int draw_depth;
static int anim_water;

static int curr_level;

static vec3_t cam_pos;
static float cam_yaw;
static float cam_pitch;

static vec3_t cam_forward;
static vec3_t cam_right;
static vec3_t cam_up;

static vec3_t light_pos;
static vec3_t light_forward;
static vec3_t light_right;
static vec3_t light_up;
static vec3_t lightdir_n;

static float focal_len;

static float move_speed;
static float mouse_sens;

static float iFracScale;
static float iFracAng1;
static float iFracAng2;
static vec3_t iFracShift;
static vec3_t iFracCol;

static vec3_t iMarblePos;
static float iMarbleRad;
static float iFlagScale;
static vec3_t iFlagPos;
static vec3_t flag_center;
static float flag_radius;

static float iTime;

static uint32_t sparse_raymarch_prog;
static uint32_t sparse_shadow_raymarch_prog;
static uint32_t depth_tex;
static uint32_t shadow_tex;
static uint32_t depth_vis_prog;

static uint32_t ui_text_prog;
static uint32_t full_raymarch_prog;
static uint32_t vao;

static uint32_t fbo;
static uint32_t render_tex;

static TTF_Font *font;
static uint32_t text_tex;
static int text_w;
static int text_h;

static float avg_fps;
static float avg_ms;

#define FPS_SAMPLE_COUNT 60
static float fps_samples[FPS_SAMPLE_COUNT];
static float ms_samples[FPS_SAMPLE_COUNT];
static int fps_sample_idx = 0;

int main(int argc, char **argv) {
  SDL_Window *window;
  SDL_GLContext gl_ctx;
  
  init_globals();
  
  #ifdef _WIN32
    SDL_SetHint(SDL_HINT_WINDOWS_DPI_AWARENESS, "permonitorv2");
  #endif
  
  SDL_Init(SDL_INIT_VIDEO | SDL_INIT_TIMER | SDL_INIT_EVENTS);
  TTF_Init();
  
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 5);
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
  
  #if SCALE_WINDOW
    int win_w = WINDOW_W * SCALE;
    int win_h = WINDOW_H * SCALE;
  #else
    int win_w = WINDOW_W;
    int win_h = WINDOW_H;
  #endif
  
  window = SDL_CreateWindow(
    "Raymarch",
    SDL_WINDOWPOS_CENTERED,
    SDL_WINDOWPOS_CENTERED,
    win_w, win_h,
    SDL_WINDOW_OPENGL | SDL_WINDOW_SHOWN
  );
  
  gl_ctx = SDL_GL_CreateContext(window);
  
  #if ENABLE_VSYNC
    SDL_GL_SetSwapInterval(1);
  #else
    SDL_GL_SetSwapInterval(0);
  #endif
  
  if (!gladLoadGL()) {
    printf("GLAD failed\n");
    exit(1);
  }
  
  glEnable(GL_DEBUG_OUTPUT);
  glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS);
  glDebugMessageCallback(MessageCallback, NULL);
  
  glDisable(GL_DEPTH_TEST);
  glEnable(GL_BLEND);
  glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  
  SDL_SetRelativeMouseMode(mouse_captured ? SDL_TRUE : SDL_FALSE);
  
  create_objects();
  setup_static_uniforms();
  
  font = TTF_OpenFont("C:/Windows/Fonts/consola.ttf", 16);
  
  #if !ENABLE_VSYNC
    const float target_dt = 1.0f / 60.0f;
  #endif
  
  iTime = 0.0f;
  
  avg_fps = 0.0f;
  avg_ms = 0.0f;
  
  uint64_t freq = SDL_GetPerformanceFrequency();
  uint64_t prev_time = SDL_GetPerformanceCounter();
  
  while (running) {
    uint64_t curr_time = SDL_GetPerformanceCounter();
    float dt = (float)(curr_time - prev_time) / (float)freq; // seconds
    prev_time = curr_time;
    
    if (anim_water) iTime += dt;
    if (iTime > 1000.0f) iTime -= 1000.0f;
    
    SDL_Event e;
    while (SDL_PollEvent(&e)) {
      if (e.type == SDL_QUIT) {
        running = 0;
      }
      
      if (e.type == SDL_KEYDOWN) {
        handle_key_event(e.key.keysym.sym, e.key.keysym.mod, window);
      }
      
      if (e.type == SDL_MOUSEMOTION && mouse_captured && !paused) {
        cam_yaw   += e.motion.xrel * mouse_sens;
        cam_pitch -= e.motion.yrel * mouse_sens;
        
        if (cam_yaw < 0.0f) {
          cam_yaw += 360.0f;
        } else if (cam_yaw > 360.0f) {
          cam_yaw -= 360.0f;
        }
        
        if (cam_pitch < -90.0f) {
          cam_pitch = -90.0f;
        } else if (cam_pitch > 90.0f) {
          cam_pitch = 90.0f;
        }
      }
    }
    
    if (!paused) {
      if (start_paused) paused = 1;
      
      update_movement(SDL_GetKeyboardState(NULL), dt);
      
      // render into fixed-resolution FBO
      glBindFramebuffer(GL_FRAMEBUFFER, fbo);
      glViewport(0, 0, WINDOW_W, WINDOW_H);
      
      glClearColor(0.02f, 0.02f, 0.03f, 1.0f);
      glClear(GL_COLOR_BUFFER_BIT);
      
      // run the shader code
      dispatch_sparse_raymarch();
      #if SHADOWS_ENABLED
        dispatch_sparse_shadow_raymarch();
      #endif
      dispatch_full_raymarch();
      
      if (draw_depth) {
        dispatch_draw_depth();
      }
      
      if (draw_debug) {
        dt = (dt > 0.001f && dt < 1.0f) ? dt : 1.0f / 60.0f;
        fps_samples[fps_sample_idx] = 1.0f / dt;
        ms_samples[fps_sample_idx] = dt * 1000.0f;
        fps_sample_idx = (fps_sample_idx + 1) % FPS_SAMPLE_COUNT;
        
        avg_fps = 0.0f;
        avg_ms = 0.0f;
        for (int i = 0; i < FPS_SAMPLE_COUNT; i++) {
          avg_fps += fps_samples[i];
          avg_ms += ms_samples[i];
        }
        avg_fps /= FPS_SAMPLE_COUNT;
        avg_ms /= FPS_SAMPLE_COUNT;
        
        print_debug();
      }
      
      // blit to window (scaled)
      glBindFramebuffer(GL_READ_FRAMEBUFFER, fbo);
      glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
      
      int dw, dh;
      #if SCALE_WINDOW
        if (!fullscreen) {
          dw = WINDOW_W * SCALE;
          dh = WINDOW_H * SCALE;
        } else {
          SDL_GL_GetDrawableSize(window, &dw, &dh);
        }
      #else
        SDL_GL_GetDrawableSize(window, &dw, &dh);
      #endif
      
      glBlitFramebuffer(
        0, 0, WINDOW_W, WINDOW_H,
        0, 0, dw, dh,
        GL_COLOR_BUFFER_BIT, GL_LINEAR
      );
      
      SDL_GL_SwapWindow(window);
      
      #if !ENABLE_VSYNC
        uint64_t end_time = SDL_GetPerformanceCounter();
        float frame_time = (float)(end_time - curr_time) / (float)freq;
        
        if (frame_time < target_dt) {
          uint32_t delay_ms = (uint32_t)((target_dt - frame_time) * 1000.0f);
          if (delay_ms > 0) SDL_Delay(delay_ms);
        }
      #endif
    }
  }
  
  TTF_CloseFont(font);
  TTF_Quit();
  SDL_GL_DeleteContext(gl_ctx);
  SDL_DestroyWindow(window);
  SDL_Quit();
  return 0;
}

static void handle_key_event(SDL_Keycode k, SDL_Keymod m, SDL_Window *window) {
  if (k == SDLK_ESCAPE) {
    running = 0;
  }
  
  if (k == SDLK_p) {
    paused = !paused;
    
    if (start_paused) {
      start_paused = 0;
    }
  }
  
  if (k == SDLK_r) {
    anim_water = !anim_water;
  }
  
  if (k == SDLK_f) {
    draw_debug = !draw_debug;
  }
  
  if (k == SDLK_g) {
    draw_depth = !draw_depth ? 1 : 0;
  }
  
  if (k == SDLK_h) {
    draw_depth = !draw_depth ? 2 : 0;
  }
  
  if (k == SDLK_n) {
    curr_level--;
    if (curr_level < 0) {
      curr_level = NUM_LEVELS - 1;
    }
    
    set_level(curr_level);
    reset_camera();
  }
  
  if (k == SDLK_m) {
    curr_level++;
    if (curr_level == NUM_LEVELS) {
      curr_level = 0;
    }
    
    set_level(curr_level);
    reset_camera();
  }
  
  if (k == SDLK_F1) {
    toggle_mouse();
  }
  
  if (k == SDLK_SPACE) {
    reset_camera();
  }
  
  if (k == SDLK_F11 || (k == SDLK_RETURN && (m & KMOD_ALT))) {
    toggle_fullscreen(window);
  }
}

static void toggle_mouse() {
  mouse_captured = !mouse_captured;
  SDL_SetRelativeMouseMode(mouse_captured ? SDL_TRUE : SDL_FALSE);
}

static void toggle_fullscreen(SDL_Window *w) {
  fullscreen = !fullscreen;
  uint32_t flags = SDL_GetWindowFlags(w);
  int fs = flags & SDL_WINDOW_FULLSCREEN_DESKTOP;
  SDL_SetWindowFullscreen(w, fs ? 0 : SDL_WINDOW_FULLSCREEN_DESKTOP);
}

static void update_movement(const uint8_t *keys, float dt) {
  float cy = cosf(DEG2RAD(cam_yaw));
  float sy = sinf(DEG2RAD(cam_yaw));
  float cp = cosf(DEG2RAD(cam_pitch));
  float sp = sinf(DEG2RAD(cam_pitch));
  
  float fx = cy * cp;
  float fy = sp;
  float fz = sy * cp;
  
  float rx = -sy;
  float rz = cy;
  
  cam_forward = (vec3_t){fx, fy, fz};
  cam_right = (vec3_t){rx, 0.0f, rz};
  
  cam_up.x = cam_right.y * cam_forward.z - cam_right.z * cam_forward.y;
  cam_up.y = cam_right.z * cam_forward.x - cam_right.x * cam_forward.z;
  cam_up.z = cam_right.x * cam_forward.y - cam_right.y * cam_forward.x;
  
  float s = move_speed * dt;
  
  if (keys[SDL_SCANCODE_W]) {
    cam_pos.x += cam_forward.x * s;
    cam_pos.y += cam_forward.y * s;
    cam_pos.z += cam_forward.z * s;
  }
  if (keys[SDL_SCANCODE_S]) {
    cam_pos.x -= cam_forward.x * s;
    cam_pos.y -= cam_forward.y * s;
    cam_pos.z -= cam_forward.z * s;
  }
  if (keys[SDL_SCANCODE_A]) {
    cam_pos.x -= cam_right.x * s;
    cam_pos.z -= cam_right.z * s;
  }
  if (keys[SDL_SCANCODE_D]) {
    cam_pos.x += cam_right.x * s;
    cam_pos.z += cam_right.z * s;
  }
  if (keys[SDL_SCANCODE_Q]) {
    cam_pos.x -= cam_up.x * s;
    cam_pos.y -= cam_up.y * s;
    cam_pos.z -= cam_up.z * s;
  }
  if (keys[SDL_SCANCODE_E]) {
    cam_pos.x += cam_up.x * s;
    cam_pos.y += cam_up.y * s;
    cam_pos.z += cam_up.z * s;
  }
}

static void init_globals() {
  start_paused = 0;
  paused = 0;
  running = 1;
  fullscreen = 0;
  mouse_captured = 1;
  draw_debug = 1;
  draw_depth = 0;
  anim_water = 0;
  
  reset_camera();
  
  focal_len = 1.2;
  
  lightdir_n = normalize(LIGHT_DIRECTION);
  
  move_speed = 0.5f;
  mouse_sens = 0.1f;
  
  text_tex = 0;
  
  curr_level = START_LEVEL;
  set_level(curr_level);
  
  const vec3_t scene_center = (vec3_t){0.0f, 0.0f, 0.0f};
  build_light_camera(scene_center, 12.0f);
}

#define INIT_VIEW 1

static void reset_camera() {
  // center view
  #if !INIT_VIEW
    cam_pos.x = 0.0f;
    cam_pos.y = 4.3f; // 4.3f
    cam_pos.z = 5.0f;
    cam_yaw = 270.0f;
    cam_pitch = 0.0f;
  // corner view
  #elif INIT_VIEW == 1
    cam_pos.x = -4.0f;
    cam_pos.y = 4.3f; // 4.3f
    cam_pos.z = -4.0f;
    cam_yaw = 45.0f;
    cam_pitch = 0.0f;
  // sea view
  #elif INIT_VIEW == 2
    cam_pos.x = 0.0f;
    cam_pos.y = 0.1f; // -0.1f underwater
    cam_pos.z = -6.5f;
    cam_yaw = 90.0f;
    cam_pitch = 0.0f;
  #endif
}

static void set_level(int level_id) {
  if (!level_id) { // Jump The Crater
    iFracScale = 1.8f;
    iFracAng1 = -0.12f;
    iFracAng2 = 0.5f;
    iFracShift = (vec3_t){-2.12f, -2.75f, 0.49f};
    iFracCol = (vec3_t){0.42f, 0.38f, 0.19f};
    iMarblePos = (vec3_t){-2.95862f, 2.68825f, -1.11868f};
    // iMarblePos = (vec3_t){0.0f, 0.07f, -5.5f}; // place the ball over the water
    iMarbleRad = 0.035f;
    iFlagPos = (vec3_t){2.95227f, 2.65057f, 1.11848f};
  } else
  if (level_id == 1) { // Too Many Trees
    iFracScale = 1.9073f;
    iFracAng1 = -9.83f;
    iFracAng2 = -1.16f;
    iFracShift = (vec3_t){-3.508f, -3.593f, 3.295f};
    iFracCol = (vec3_t){-0.34f, 0.12f, -0.08f};
    iMarblePos = (vec3_t){-3.40191f, 4.14347f, -3.48312f};
    iMarbleRad = 0.04f;
    iFlagPos = (vec3_t){3.40191f, 4.065f, 3.48312f};
  } else
  if (level_id == 2) { // Hole In One
    iFracScale = 2.02f;
    iFracAng1 = -1.57f;
    iFracAng2 = 1.62f;
    iFracShift = (vec3_t){-3.31f, 6.19f, 1.53f};
    iFracCol = (vec3_t){0.12f, -0.09f, -0.09f};
    iMarblePos = (vec3_t){3.18387f, 5.99466f, 0.0f};
    iMarbleRad = 0.009f;
    iFlagPos = (vec3_t){0.0f, -6.25f, 0.0f};
  } else
  if (level_id == 3) { // Fatal Fissures
    iFracScale = 2.13f;
    iFracAng1 = -1.77f;
    iFracAng2 = -1.62f;
    iFracShift = (vec3_t){-4.99f, -3.05f, -4.48f};
    iFracCol = (vec3_t){0.42f, 0.38f, 0.19f};
    iMarblePos = (vec3_t){0.479104f,  2.18768f, -4.29408f};
    iMarbleRad = 0.01f;
    iFlagPos = (vec3_t){0.479104f,  2.177f, 4.29408f};
  }
  
  calculate_flag_radius();
}

static void calculate_flag_radius() {
  iFlagScale = iMarbleRad;
  vec3_t cloth_center = vec3_add(iFlagPos, vec3_scale((vec3_t){1.5f, 4.0f, 0.0f}, iFlagScale));
  vec3_t pole_center = vec3_add(iFlagPos, (vec3_t){0.0f, iFlagScale * 2.4f, 0.0f});

  vec3_t cloth_size = vec3_scale((vec3_t){1.5f, 0.8f, 0.08f}, iMarbleRad);

  float cloth_radius = length(cloth_size);
  float pole_radius = iMarbleRad * 2.4f + iMarbleRad * 0.18f;

  flag_center = vec3_scale(vec3_add(cloth_center, pole_center), 0.5f);

  float r0 = length(vec3_sub(cloth_center, flag_center)) + cloth_radius;
  float r1 = length(vec3_sub(pole_center,  flag_center)) + pole_radius;

  flag_radius = fmaxf(r0, r1);
}

static void build_light_camera(vec3_t scene_center, float light_distance) {
  vec3_t forward = (vec3_t){-lightdir_n.x, -lightdir_n.y, -lightdir_n.z};

  vec3_t tmp = fabsf(forward.y) < 0.99f
    ? (vec3_t){0.0f,1.0f,0.0f}
    : (vec3_t){1.0f,0.0f,0.0f};

  vec3_t right = normalize(cross(tmp, forward));
  vec3_t up = cross(forward, right);

  light_forward = forward;
  light_right = right;
  light_up = up;

  light_pos.x = scene_center.x - forward.x * light_distance;
  light_pos.y = scene_center.y - forward.y * light_distance;
  light_pos.z = scene_center.z - forward.z * light_distance;
}

static void create_objects() {
  // create the depth texture
  glGenTextures(1, &depth_tex);
  glBindTexture(GL_TEXTURE_2D, depth_tex);
  glTexStorage2D(GL_TEXTURE_2D, 1, GL_R32F, NUM_RAYS_X, NUM_RAYS_Y);
  
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
  
  // create the shadow depth texture
  glGenTextures(1, &shadow_tex);
  glBindTexture(GL_TEXTURE_2D, shadow_tex);
  glTexStorage2D(GL_TEXTURE_2D, 1, GL_R32F, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
  
  // create the text texture
  glGenTextures(1, &text_tex);
  
  // vertex array object
  glGenVertexArrays(1, &vao);
  glBindVertexArray(vao);
  
  // load the shaders
  load_ui_text();
  load_sparse_raymarch();
  #if SHADOWS_ENABLED
    load_sparse_shadow_raymarch();
  #endif
  load_draw_depth();
  load_full_raymarch();
  
  // create fixed-resolution render target
  glGenFramebuffers(1, &fbo);
  glBindFramebuffer(GL_FRAMEBUFFER, fbo);
  
  glGenTextures(1, &render_tex);
  glBindTexture(GL_TEXTURE_2D, render_tex);
  glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, WINDOW_W, WINDOW_H, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
  
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
  
  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, render_tex, 0);
  
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

static void load_ui_text() {
  const char *vs_str = "shaders/fsq.vert";
  const char *fs_str = "shaders/ui_text.frag";
  
  char *vs_src = load_text_file(vs_str);
  char *fs_src = load_text_file(fs_str);
  
  uint32_t vs = glCreateShader(GL_VERTEX_SHADER);
  uint32_t fs = glCreateShader(GL_FRAGMENT_SHADER);
  
  glShaderSource(vs, 1, (const GLchar **)&vs_src, NULL);
  glShaderSource(fs, 1, (const GLchar **)&fs_src, NULL);
  
  glCompileShader(vs);
  glCompileShader(fs);
  check_shader_compile(vs, vs_str);
  check_shader_compile(fs, fs_str);
  
  ui_text_prog = glCreateProgram();
  glAttachShader(ui_text_prog, vs);
  glAttachShader(ui_text_prog, fs);
  glLinkProgram(ui_text_prog);
  
  glDeleteShader(vs);
  glDeleteShader(fs);
  
  free(vs_src);
  free(fs_src);
}

static void load_sparse_raymarch() {
  const char *cs_str = "shaders/sparse_raymarch.comp";
  
  char *cs_src = load_text_file(cs_str);
  
  uint32_t cs = glCreateShader(GL_COMPUTE_SHADER);
  glShaderSource(cs, 1, (const GLchar **)&cs_src, NULL);
  glCompileShader(cs);
  check_shader_compile(cs, cs_str);
  
  sparse_raymarch_prog = glCreateProgram();
  glAttachShader(sparse_raymarch_prog, cs);
  glLinkProgram(sparse_raymarch_prog);
  
  glDeleteShader(cs);
  free(cs_src);
}

static void load_sparse_shadow_raymarch() {
  const char *cs_str = "shaders/sparse_shadow_raymarch.comp";
  
  char *cs_src = load_text_file(cs_str);
  
  uint32_t cs = glCreateShader(GL_COMPUTE_SHADER);
  glShaderSource(cs, 1, (const GLchar **)&cs_src, NULL);
  glCompileShader(cs);
  check_shader_compile(cs, cs_str);
  
  sparse_shadow_raymarch_prog = glCreateProgram();
  glAttachShader(sparse_shadow_raymarch_prog, cs);
  glLinkProgram(sparse_shadow_raymarch_prog);
  
  glDeleteShader(cs);
  free(cs_src);
}

static void load_draw_depth() {
  const char *vs_str = "shaders/fsq.vert";
  const char *fs_str = "shaders/draw_depth.frag";
  
  char *vs_src = load_text_file(vs_str);
  char *fs_src = load_text_file(fs_str);
  
  uint32_t vs = glCreateShader(GL_VERTEX_SHADER);
  uint32_t fs = glCreateShader(GL_FRAGMENT_SHADER);
  
  glShaderSource(vs, 1, (const GLchar **)&vs_src, NULL);
  glShaderSource(fs, 1, (const GLchar **)&fs_src, NULL);
  
  glCompileShader(vs);
  glCompileShader(fs);
  check_shader_compile(vs, vs_str);
  check_shader_compile(fs, fs_str);
  
  depth_vis_prog = glCreateProgram();
  glAttachShader(depth_vis_prog, vs);
  glAttachShader(depth_vis_prog, fs);
  glLinkProgram(depth_vis_prog);
  
  glDeleteShader(vs);
  glDeleteShader(fs);
  
  free(vs_src);
  free(fs_src);
}

static void load_full_raymarch() {
  const char *vs_str = "shaders/fsq.vert";
  const char *fs_str = "shaders/full_raymarch.frag";
  
  char *vs_src = load_text_file(vs_str);
  char *fs_src = load_text_file(fs_str);
  
  uint32_t vs = glCreateShader(GL_VERTEX_SHADER);
  uint32_t fs = glCreateShader(GL_FRAGMENT_SHADER);
  
  glShaderSource(vs, 1, (const GLchar **)&vs_src, NULL);
  glShaderSource(fs, 1, (const GLchar **)&fs_src, NULL);
  
  glCompileShader(vs);
  glCompileShader(fs);
  check_shader_compile(vs, vs_str);
  check_shader_compile(fs, fs_str);
  
  full_raymarch_prog = glCreateProgram();
  glAttachShader(full_raymarch_prog, vs);
  glAttachShader(full_raymarch_prog, fs);
  glLinkProgram(full_raymarch_prog);
  
  glDeleteShader(vs);
  glDeleteShader(fs);
  
  free(vs_src);
  free(fs_src);
}

static void setup_static_uniforms() {
  glUseProgram(ui_text_prog);
  glUniform1i(glGetUniformLocation(ui_text_prog, "uTextTex"), 1);
  
  glUseProgram(sparse_raymarch_prog);
  
  glUniform2i(glGetUniformLocation(sparse_raymarch_prog, "uResolution"), NUM_RAYS_X, NUM_RAYS_Y);
  glUniform1i(glGetUniformLocation(sparse_raymarch_prog, "uMaxSteps"), MAX_STEPS);
  
  glUniform1f(glGetUniformLocation(sparse_raymarch_prog, "depth_near"), DEPTH_NEAR);
  glUniform1f(glGetUniformLocation(sparse_raymarch_prog, "depth_far"), DEPTH_FAR);
  glUniform1f(glGetUniformLocation(sparse_raymarch_prog, "focal_len"), focal_len);
  
  glUseProgram(sparse_shadow_raymarch_prog);
  
  glUniform2i(glGetUniformLocation(sparse_shadow_raymarch_prog, "uResolution"), SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  glUniform1i(glGetUniformLocation(sparse_shadow_raymarch_prog, "uMaxSteps"), MAX_STEPS);
  
  glUniform3f(glGetUniformLocation(sparse_shadow_raymarch_prog, "light_pos"), light_pos.x, light_pos.y, light_pos.z);
  glUniform3f(glGetUniformLocation(sparse_shadow_raymarch_prog, "light_forward"), light_forward.x, light_forward.y, light_forward.z);
  glUniform3f(glGetUniformLocation(sparse_shadow_raymarch_prog, "light_right"), light_right.x, light_right.y, light_right.z);
  glUniform3f(glGetUniformLocation(sparse_shadow_raymarch_prog, "light_up"), light_up.x, light_up.y, light_up.z);
  
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "depth_near"), DEPTH_NEAR);
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "depth_far"), DEPTH_FAR);
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "focal_len"), focal_len);
  
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "ortho_scale"), ORTHO_SCALE);
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "shadow_sharpness"), SHADOW_SHARPNESS);
  
  glUseProgram(depth_vis_prog);
  
  glUniform2i(glGetUniformLocation(depth_vis_prog, "uResolution"), WINDOW_W, WINDOW_H);
  glUniform1f(glGetUniformLocation(depth_vis_prog, "depth_far"), DEPTH_FAR);
  
  glUseProgram(full_raymarch_prog);
  
  glUniform2i(glGetUniformLocation(full_raymarch_prog, "uResolution"), WINDOW_W, WINDOW_H);
  glUniform1i(glGetUniformLocation(full_raymarch_prog, "uMaxSteps"), MAX_STEPS);
  glUniform1i(glGetUniformLocation(full_raymarch_prog, "uStride"), STRIDE);
  
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "depth_near"), DEPTH_NEAR);
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "depth_far"), DEPTH_FAR);
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "focal_len"), focal_len);
  
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "lightdir_n"), lightdir_n.x, lightdir_n.y, lightdir_n.z);
  
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "light_pos"), light_pos.x, light_pos.y, light_pos.z);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "light_forward"), light_forward.x, light_forward.y, light_forward.z);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "light_right"), light_right.x, light_right.y, light_right.z);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "light_up"), light_up.x, light_up.y, light_up.z);
  
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "ortho_scale"), ORTHO_SCALE);
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "shadow_sharpness"), SHADOW_SHARPNESS);
}

static void dispatch_ui_text() {
  if (!text_tex)
    return;
  
  glUseProgram(ui_text_prog);
  
  glUniform2f(glGetUniformLocation(ui_text_prog, "uScreenSize"), WINDOW_W, WINDOW_H);
  glUniform2f(glGetUniformLocation(ui_text_prog, "uTextPos"), 10.0f, 10.0f);
  glUniform2f(glGetUniformLocation(ui_text_prog, "uTextSize"), (float)text_w, (float)text_h);
  
  glBindTextureUnit(1, text_tex);
  glDrawArrays(GL_TRIANGLES, 0, 3);
}

static void dispatch_sparse_raymarch() {
  // float clear_depth = 1.0f;
  // glClearTexImage(depth_tex, 0, GL_RED, GL_FLOAT, &clear_depth);
  
  glUseProgram(sparse_raymarch_prog);
  
  glUniform3f(glGetUniformLocation(sparse_raymarch_prog, "cam_pos"), cam_pos.x, cam_pos.y, cam_pos.z);
  glUniform3f(glGetUniformLocation(sparse_raymarch_prog, "cam_forward"), cam_forward.x, cam_forward.y, cam_forward.z);
  glUniform3f(glGetUniformLocation(sparse_raymarch_prog, "cam_right"), cam_right.x, cam_right.y, cam_right.z);
  glUniform3f(glGetUniformLocation(sparse_raymarch_prog, "cam_up"), cam_up.x, cam_up.y, cam_up.z);
  
  glUniform1f(glGetUniformLocation(sparse_raymarch_prog, "iFracScale"), iFracScale);
  glUniform1f(glGetUniformLocation(sparse_raymarch_prog, "iFracAng1"), iFracAng1);
  glUniform1f(glGetUniformLocation(sparse_raymarch_prog, "iFracAng2"), iFracAng2);
  glUniform3f(glGetUniformLocation(sparse_raymarch_prog, "iFracShift"), iFracShift.x, iFracShift.y, iFracShift.z);
  glUniform3f(glGetUniformLocation(sparse_raymarch_prog, "iFracCol"), iFracCol.x, iFracCol.y, iFracCol.z);
  
  glUniform3f(glGetUniformLocation(sparse_raymarch_prog, "iMarblePos"), iMarblePos.x, iMarblePos.y, iMarblePos.z);
  glUniform1f(glGetUniformLocation(sparse_raymarch_prog, "iMarbleRad"), iMarbleRad);
  glUniform1f(glGetUniformLocation(sparse_raymarch_prog, "iFlagScale"), iFlagScale);
  glUniform3f(glGetUniformLocation(sparse_raymarch_prog, "iFlagPos"), iFlagPos.x, iFlagPos.y, iFlagPos.z);
  glUniform3f(glGetUniformLocation(sparse_raymarch_prog, "flag_center"), flag_center.x, flag_center.y, flag_center.z);
  glUniform1f(glGetUniformLocation(sparse_raymarch_prog, "flag_radius"), flag_radius);
  
  glBindImageTexture(0, depth_tex, 0, GL_FALSE, 0, GL_WRITE_ONLY, GL_R32F);
  glDispatchCompute((NUM_RAYS_X + 15) / 16, (NUM_RAYS_Y + 15) / 16, 1);
  
  glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT);
}

static void dispatch_sparse_shadow_raymarch() {
  glUseProgram(sparse_shadow_raymarch_prog);
  
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "iFracScale"), iFracScale);
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "iFracAng1"), iFracAng1);
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "iFracAng2"), iFracAng2);
  glUniform3f(glGetUniformLocation(sparse_shadow_raymarch_prog, "iFracShift"), iFracShift.x, iFracShift.y, iFracShift.z);
  glUniform3f(glGetUniformLocation(sparse_shadow_raymarch_prog, "iFracCol"), iFracCol.x, iFracCol.y, iFracCol.z);
  
  glUniform3f(glGetUniformLocation(sparse_shadow_raymarch_prog, "iMarblePos"), iMarblePos.x, iMarblePos.y, iMarblePos.z);
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "iMarbleRad"), iMarbleRad);
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "iFlagScale"), iFlagScale);
  glUniform3f(glGetUniformLocation(sparse_shadow_raymarch_prog, "iFlagPos"), iFlagPos.x, iFlagPos.y, iFlagPos.z);
  glUniform3f(glGetUniformLocation(sparse_shadow_raymarch_prog, "flag_center"), flag_center.x, flag_center.y, flag_center.z);
  glUniform1f(glGetUniformLocation(sparse_shadow_raymarch_prog, "flag_radius"), flag_radius);
  
  glBindImageTexture(0, shadow_tex, 0, GL_FALSE, 0, GL_WRITE_ONLY, GL_R32F);
  glDispatchCompute((SHADOW_MAP_SIZE + 15) / 16, (SHADOW_MAP_SIZE + 15) / 16, 1);
  
  glMemoryBarrier(GL_TEXTURE_FETCH_BARRIER_BIT);
}

static void dispatch_draw_depth() {
  glUseProgram(depth_vis_prog);
  
  if (draw_depth == 1) {
    glBindTextureUnit(0, depth_tex);
  } else {
    glBindTextureUnit(0, shadow_tex);
  }
  glDrawArrays(GL_TRIANGLES, 0, 3);
}

static void dispatch_full_raymarch() {
  glUseProgram(full_raymarch_prog);
  
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "cam_pos"), cam_pos.x, cam_pos.y, cam_pos.z);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "cam_forward"), cam_forward.x, cam_forward.y, cam_forward.z);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "cam_right"), cam_right.x, cam_right.y, cam_right.z);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "cam_up"), cam_up.x, cam_up.y, cam_up.z);
  
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "iFracScale"), iFracScale);
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "iFracAng1"), iFracAng1);
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "iFracAng2"), iFracAng2);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "iFracShift"), iFracShift.x, iFracShift.y, iFracShift.z);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "iFracCol"), iFracCol.x, iFracCol.y, iFracCol.z);
  
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "iMarblePos"), iMarblePos.x, iMarblePos.y, iMarblePos.z);
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "iMarbleRad"), iMarbleRad);
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "iFlagScale"), iFlagScale);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "iFlagPos"), iFlagPos.x, iFlagPos.y, iFlagPos.z);
  glUniform3f(glGetUniformLocation(full_raymarch_prog, "flag_center"), flag_center.x, flag_center.y, flag_center.z);
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "flag_radius"), flag_radius);
  
  glUniform1f(glGetUniformLocation(full_raymarch_prog, "iTime"), iTime);
  
  glBindTextureUnit(0, depth_tex);
  glDrawArrays(GL_TRIANGLES, 0, 3);
}

static void check_shader_compile(uint32_t shader, const char *name) {
  GLint ok = 0;
  glGetShaderiv(shader, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    GLint len = 0;
    glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &len);
    char *log = malloc(len);
    glGetShaderInfoLog(shader, len, NULL, log);
    printf("failed to compile shader: %s\n%s\n", name, log);
    free(log);
    exit(1);
  }
}

static char* load_text_file(const char *path) {
  FILE *file = fopen(path, "rb");
  
  if (!file) {
    printf("can't load the files\n");
    return NULL;
  }
  
  fseek(file, 0, SEEK_END);
  long size = ftell(file);
  fseek(file, 0, SEEK_SET);
  
  char *buffer = malloc(size + 1);
  if (!buffer) {
    fclose(file);
    printf("can't allocate memory\n");
    return NULL;
  }
  
  fread(buffer, 1, size, file);
  buffer[size] = 0;
  
  fclose(file);
  return buffer;
}

static void update_debug_text(const char *str) {
  SDL_Color color = {250, 250, 250, 255};
  int wrap_width = 400;
  SDL_Surface *s = TTF_RenderText_Blended_Wrapped(font, str, color, wrap_width);
  if (!s) return;
  
  text_w = s->w;
  text_h = s->h;
  
  glActiveTexture(GL_TEXTURE1);
  glBindTexture(GL_TEXTURE_2D, text_tex);
  glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
  glPixelStorei(GL_UNPACK_ROW_LENGTH, s->pitch / 4);
  glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, s->w, s->h, 0, GL_BGRA, GL_UNSIGNED_BYTE, s->pixels);
  glPixelStorei(GL_UNPACK_ROW_LENGTH, 0);
  
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
  
  SDL_FreeSurface(s);
}

static void print_debug() {
  char buffer[256];
  snprintf(buffer, sizeof(buffer),
    "%.1f fps | %.2f ms\n"
    "pos %.2f x %.2f y %.2f z\n"
    "dir %.2f y %.2f x",
    avg_fps, avg_ms,
    cam_pos.x, cam_pos.y, cam_pos.z,
    cam_yaw, cam_pitch
  );
  
  update_debug_text(buffer);
  dispatch_ui_text();
}

void GLAPIENTRY MessageCallback(
  GLenum source,
  GLenum type,
  uint32_t id,
  GLenum severity,
  GLsizei length,
  const GLchar* message,
  const void* userParam) {
  fprintf(stderr, "GL CALLBACK: %s type = 0x%x, severity = 0x%x, message = %s\n",
         (type == GL_DEBUG_TYPE_ERROR ? "** GL ERROR **" : ""),
          type, severity, message);
}