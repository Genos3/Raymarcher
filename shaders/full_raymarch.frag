#version 430 core

#define ENABLE_SPARSE_RAYS 1
#define ENABLE_SHADOW_SPARSE_RAYS 1

#if ENABLE_SPARSE_RAYS
  layout(binding = 0) uniform sampler2D depth_tex;
  layout(binding = 1) uniform sampler2D shadow_tex;
#endif

#define FRACTAL_ITER 16
#define MIN_DIST 1e-5
#define MIN_DIST_S (MIN_DIST * 10.0)
#define FULL_NORMAL 1
#define DRAW_DE 0

#define SHADOWS_ENABLED 1
#define SHADOW_DARKNESS 0.7
#define SPECULAR_ENABLED 1
#define SPECULAR_SHININESS 32
#define SPECULAR_STRENGTH 0.8
#define AO_ENABLED 1
#define FULL_AO 1
#define AO_SAMPLES 3
#define AO_SCALE 0.05
#define AMBIENT_COLOR vec3(0.3, 0.35, 0.4)
#define BACKGROUND_COLOR vec3(0.6, 0.8, 1.0)
#define LIGHT_COLOR vec3(1.0, 0.95, 0.8)
#define HAZE_COLOR vec3(0.85, 0.9, 1.0)
#define SUN_ENABLED 1
#define SUN_SHARPNESS 2.0
#define SUN_SIZE 0.0004
#define VIGNETTE_ENABLED 0
#define VIGNETTE_STRENGTH 0.5
#define SKY_ENABLED 1
#define FOG_ENABLED 0
#define SEA_ENABLED 1
#define VOLUMETRIC_WAVES 1
#define ENABLE_WATER_REFLECTION 0
#define ENABLE_WATER_REFRACTION 0
#define ENABLE_REFL_REFR_WATER (ENABLE_WATER_REFLECTION | ENABLE_WATER_REFRACTION)
#define ENABLE_SHADOWS_ON_SEA 1
#define ENABLE_WAVE_CAUSTICS 1
#define BLINN_PHONG_SEA 0
#define SEA_LEVEL 0.0
#define SEA_COLOR vec3(0.02, 0.05, 0.08)
#define LIGHT_BLUE vec3(0.12, 0.64, 0.89)

// waves parameters
#define WAVE_H1 0.02
#define WAVE_H2 0.01
#define MAX_SEA_HEIGHT (WAVE_H1 + WAVE_H2)

#define WAVE_X1 5.0
#define WAVE_Z1 3.0
#define WAVE_T1 0.8

#define WAVE_X2 13.0
#define WAVE_Z2 7.0
#define WAVE_T2 1.3

#define COLORED_GLASS_MARBLE 0
#define MARBLE_DIFFUSE 0
#define MARBLE_FRESNEL 1
#define MARBLE_COLOR vec3(0.2, 0.2, 0.8) // blue
// #define MARBLE_COLOR vec3(0.7, 0.7, 0.7) // gray

#define DEFAULT_REFRACTION 1
#define DEFAULT_REFLECTION 1
#define DEBUG_SPHERES 0
#define VIEW_SHADOWMAP 0
#define ENABLE_WATER_SEC_BOUNCE 0
#define RELAXED_RAYMARCH 0 // same speed

#define OUTPUT_ENABLED 1 // used for debugging

// elements id's
#define AIR 0
#define FRACTAL 1
#define MARBLE 2
#define FLAG 3
#define SEA 4

// ray types // not needed
#define PRIM_RAY 0
#define REFL_RAY 1
#define REFR_RAY 2

#if DEFAULT_REFRACTION
  #define refract refraction
#endif
#if DEFAULT_REFLECTION
  #define reflect reflection
#endif

void mengerFold(inout vec4 z);
void rotX(inout vec4 z, float a);
void rotZ(inout vec4 z, float a);
float ray_sphere(vec3 p, vec3 rd, vec3 center, float radius);
float ray_y_plane(vec3 p, vec3 rd, float base);
float de_sphere(vec3 p, float r);
float de_box_w(vec4 p, vec3 b);
float de_box(vec3 p, vec3 b);
float de_capsule(vec3 p, float h, float r);
float de_fractal(vec3 pos);
vec3 col_fractal(vec3 pos);
vec4 ld_scene(vec3 pos);
float de_marble(vec3 p);
float de_flag(vec3 p);
vec3 col_flag(vec3 p);
float de_scene(vec3 p, bool an_hit_marble, bool an_hit_flag);
float de_scene_sh(vec3 p, bool an_hit_marble, bool an_hit_flag);
float de_scene_ao(vec3 p, bool an_hit_marble, bool an_hit_flag);
float de_scene_n(vec3 p);
vec3 col_scene(vec3 p);
vec3 calcNormal(vec3 p, float dx);
vec3 fastNormal(vec3 p, float d, float dx);
float calcAO(vec3 p, vec3 n);
vec3 reflection(vec3 rd, vec3 n);
vec3 refraction(vec3 rd, vec3 n, float p);
vec4 raymarch(inout vec3 p, vec3 rd, float init_dist, bool hit_sea, float t_sea_min, float t_sea_max);
vec2 raymarch_shadow_inv(vec3 p, vec3 rd, float init_dist, float sharpness);
float raymarch_shadow_marble(vec3 p, vec3 rd, float init_dist, float sharpness, float an_t_marble);
vec4 relaxed_raymarch(inout vec3 p, vec3 rd, float init_dist, bool hit_sea, float t_sea_min, float t_sea_max);
#if SHADOWS_ENABLED
  vec2 trace_marble(vec3 p, vec3 rd);
#endif
#if ENABLE_SHADOW_SPARSE_RAYS && VIEW_SHADOWMAP
  float shadow_lookup(vec3 p, float min_dist);
#endif
#if FULL_NORMAL
  vec3 frac_color(vec3 p, vec3 rd, vec3 n, float k, float min_dist, float prev_d);
#else
  vec3 frac_color(vec3 p, vec3 rd, float k, float min_dist, float prev_d);
#endif
vec3 sky_color(vec3 rd);
vec3 marble_color(vec3 p, vec3 rd);
vec3 sea_color(vec3 rd);
vec3 get_waves_normal(bool p_is_underwater);
#if !VOLUMETRIC_WAVES
  bool ray_sea_plane_hit(vec3 p, vec3 rd, out float t_sea);
  void set_sea_plane_struct(vec3 p, vec3 rd);
#else
  bool ray_sea_slab_hit(vec3 p, vec3 rd, out float t_min, out float t_max);
  float wave_height(vec3 p, float t);
  bool test_vol_sea_hit(vec3 p, vec3 rd, bool p_is_underwater);
  bool test_if_underwater(vec3 p);
#endif
#if !ENABLE_REFL_REFR_WATER
  vec3 sea_surface_color(vec3 p, vec3 rd, bool p_is_underwater);
#else
  vec3 waves_surface_color(vec3 p, vec3 rd, vec3 n);
#endif
vec3 waves_color(vec3 p, vec3 rd, bool p_is_underwater);
vec3 scene(vec3 p, vec3 rd, float init_dist, int ray_id, bool p_is_underwater);

out vec4 fragColor;

uniform ivec2 uResolution;
uniform int uMaxSteps;
uniform int uStride;

uniform vec3 cam_pos;
uniform vec3 cam_forward;
uniform vec3 cam_right;
uniform vec3 cam_up;
uniform float depth_near;
uniform float depth_far;
uniform float focal_len;

uniform vec3 lightdir_n;

uniform float iFracScale;
uniform float iFracAng1;
uniform float iFracAng2;
uniform vec3 iFracShift;
uniform vec3 iFracCol;

uniform vec3 iMarblePos;
uniform float iMarbleRad;
uniform float iFlagScale;
uniform vec3 iFlagPos;
uniform vec3 flag_center;
uniform float flag_radius;

uniform float iTime;

uniform vec3 light_pos;
uniform vec3 light_forward;
uniform vec3 light_right;
uniform vec3 light_up;
uniform float ortho_scale;
uniform float shadow_sharpness;

float FOVperPixel;
int closer_elem;
int closer_elem_sh;
int elem_hit;
int elem_hit_sh;

bool g_hit_scene;
float t_scene;
bool cam_is_underwater;

struct sea_t {
  float a1;
  float a2;
  float fade;
  float t;
  vec3 p;
};

sea_t r_sea;

#if VIGNETTE_ENABLED
  vec2 screen_pos;
#endif
#if DRAW_DE
  float num_DEs;
#endif

// Fold functions

void mengerFold(inout vec4 z) {
  float a = min(z.x - z.y, 0.0);
  z.x -= a;
  z.y += a;
  a = min(z.x - z.z, 0.0);
  z.x -= a;
  z.z += a;
  a = min(z.y - z.z, 0.0);
  z.y -= a;
  z.z += a;
}

void rotX(inout vec4 z, float a) {
  float s = sin(a), c = cos(a);
  z.yz = vec2(c * z.y + s * z.z, c * z.z - s * z.y);
}

void rotZ(inout vec4 z, float a) {
  float s = sin(a), c = cos(a);
  z.xy = vec2(c * z.x + s * z.y, c * z.y - s * z.x);
}

// analytical ray vs sphere test

float ray_sphere(vec3 p, vec3 rd, vec3 center, float radius) {
  vec3 oc = p - center;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - radius * radius;
  float h = b * b - c;
  
  if (h < 0.0) return -1.0;  // miss
  
  float s = sqrt(h);
  float t = -b - s;
  if (t < 0.0) t = -b + s;

  return t;
}

// analytical ray vs non axis aligned plane

float ray_plane(vec3 p, vec3 rd, vec3 n) {
  return -dot(n, p) / dot(n, rd);
}

// primitive DEs

float de_sphere(vec3 p, float r) {
	return length(p) - r;
}

float de_box_w(vec4 p, vec3 b) {
  vec3 a = abs(p.xyz) - b;
  return (min(max(max(a.x, a.y), a.z), 0.0) + length(max(a, 0.0))) / p.w;
}

float de_box(vec3 p, vec3 b) {
  vec3 a = abs(p.xyz) - b;
  return min(max(max(a.x, a.y), a.z), 0.0) + length(max(a, 0.0));
}

float de_capsule(vec3 p, float h, float r) {
	p.y -= clamp(p.y, -h, h);
	return length(p.xyz) - r;
}

// main DEs

float de_fractal(vec3 pos) {
  vec4 p = vec4(pos, 1.0);

  for (int i = 0; i < FRACTAL_ITER; ++i) {
    p.xyz = abs(p.xyz);
    rotZ(p, iFracAng1);
    mengerFold(p);
    rotX(p, iFracAng2);
    p *= iFracScale;
    p.xyz += iFracShift;
  }
  
  return de_box_w(p, vec3(6.0));
}

vec3 col_fractal(vec3 pos) {
  vec4 p = vec4(pos, 1.0);
  vec3 orbit = vec3(0.0);
  
  for (int i = 0; i < FRACTAL_ITER; ++i) {
    p.xyz = abs(p.xyz);
    rotZ(p, iFracAng1);
    mengerFold(p);
    rotX(p, iFracAng2);
    p *= iFracScale;
    p.xyz += iFracShift;
    
    orbit = max(orbit, p.xyz * iFracCol);
  }
  
  return clamp(orbit, 0.0, 1.0);
}

vec4 ld_scene(vec3 pos) {
  vec4 p = vec4(pos, 1.0);
  vec3 orbit = vec3(0.0);
  
  for (int i = 0; i < FRACTAL_ITER; ++i) {
    p.xyz = abs(p.xyz);
    rotZ(p, iFracAng1);
    mengerFold(p);
    rotX(p, iFracAng2);
    p *= iFracScale;
    p.xyz += iFracShift;
    
    if (i < 12) {
      orbit = max(orbit, p.xyz * iFracCol);
    }
  }
  
  return vec4(clamp(orbit, 0.0, 1.0), de_box_w(p, vec3(6.0)));
}

float de_marble(vec3 p) {
	return de_sphere(p - iMarblePos, iMarbleRad);
}

float de_flag(vec3 p) {
	vec3 f_pos = iFlagPos + vec3(1.5, 4, 0) * iFlagScale;
	float d = de_box(p - f_pos, vec3(1.5, 0.8, 0.08) * iMarbleRad);
	d = min(d, de_capsule(p - vec3(iFlagPos + vec3(0, iFlagScale * 2.4, 0)), iMarbleRad * 2.4, iMarbleRad * 0.18));
	return d;
}

vec3 col_flag(vec3 p) {
	vec3 f_pos = iFlagPos + vec3(1.5, 4, 0) * iFlagScale;
	float d1 = de_box(p - f_pos, vec3(1.5, 0.8, 0.08) * iMarbleRad);
	float d2 = de_capsule(p - vec3(iFlagPos + vec3(0, iFlagScale*2.4, 0)), iMarbleRad * 2.4, iMarbleRad * 0.18);
	if (d1 < d2) {
		return vec3(1.0, 0.2, 0.1);
	} else {
		return vec3(0.9, 0.9, 0.1);
	}
}

float de_scene(vec3 p, bool an_hit_marble, bool an_hit_flag) {
  float d = de_fractal(p);
  closer_elem = FRACTAL;
  
  if (an_hit_marble) {
    float dm = de_marble(p);
    if (dm < d) {
      d = dm;
      closer_elem = MARBLE;
    }
  }
  
  if (an_hit_flag) {
    float df = de_flag(p);
    if (df < d) {
      d = df;
      closer_elem = FLAG;
    }
  }
  
  return d;
}

float de_scene_sh(vec3 p, bool an_hit_marble, bool an_hit_flag) {
  float d = de_fractal(p);
  closer_elem_sh = FRACTAL;
  
  if (an_hit_marble) {
    float dm = de_marble(p);
    if (dm < d) {
      d = dm;
      closer_elem_sh = MARBLE;
    }
  }
  
  if (an_hit_flag) {
    float df = de_flag(p);
    if (df < d) {
      d = df;
      closer_elem_sh = FLAG;
    }
  }
  
  return d;
}

float de_scene_ao(vec3 p, bool an_hit_marble, bool an_hit_flag) {
  float d = de_fractal(p);
  
  if (an_hit_marble) {
    float dm = de_marble(p);
    if (dm < d) {
      d = dm;
    }
  }
  
  if (an_hit_flag) {
    float df = de_flag(p);
    if (df < d) {
      d = df;
    }
  }
  
  return d;
}

float de_scene_n(vec3 p) {
  if (elem_hit == FRACTAL) {
    return de_fractal(p);
  } else
  if (elem_hit == MARBLE) {
    return de_marble(p);
  } else
  if (elem_hit == FLAG) {
    return de_flag(p);
  }
}

vec3 col_scene(vec3 p) {
  vec3 col;
  if (elem_hit == FRACTAL) {
    col = col_fractal(p);
  } else
  if (elem_hit == FLAG) {
    col = col_flag(p);
  }
  return col;
}

vec3 calcNormal(vec3 p, float dx) {
  const vec2 k = vec2(1, -1);
  return normalize(
    k.xyy * de_scene_n(p + k.xyy * dx) +
    k.yyx * de_scene_n(p + k.yyx * dx) +
    k.yxy * de_scene_n(p + k.yxy * dx) +
    k.xxx * de_scene_n(p + k.xxx * dx)
  );
}

vec3 fastNormal(vec3 p, float d, float dx) {
  return normalize(vec3(
    de_scene_n(p + vec3(dx, 0, 0)),
    de_scene_n(p + vec3(0, dx, 0)),
    de_scene_n(p + vec3(0, 0, dx))) - vec3(d, d, d)
  );
}

float calcAO(vec3 p, vec3 n) {
  // analytically test the marble and the flag
  float an_t_marble = ray_sphere(p, n, iMarblePos, iMarbleRad);
  float an_t_flag = ray_sphere(p, n, flag_center, flag_radius);
  
  bool an_hit_marble = an_t_marble > 0.0;
  bool an_hit_flag = an_t_flag > 0.0;
  
  float ao = 0.0;
  float t = 0.05;
  elem_hit = 0;

  for (int i = 0; i < AO_SAMPLES; i++) {
    float d = de_scene_ao(p + n * t, an_hit_marble, an_hit_flag);
    ao += max(0.0, (t - d) / t);
    
    if (d < MIN_DIST) break;
    
    // t *= 1.6;
    t *= pow(4.0, 1.0 / float(AO_SAMPLES - 1));
  }

  return clamp(1.0 - ao * 0.2, 0.0, 1.0);
}

vec3 reflection(vec3 rd, vec3 n) {
  return rd - n * (2 * dot(rd, n));
}

// original function
/* vec3 refraction(vec3 rd, vec3 n, float p) {
	float dot_nd = dot(rd, n);
	return p * (rd - dot_nd * n) + sqrt(1.0 - (p * p) * (1.0 - dot_nd * dot_nd)) * n;
} */

vec3 refraction(vec3 rd, vec3 n, float eta) {
  float dot_nd = dot(n, rd);
  float k = 1.0 - eta * eta * (1.0 - dot_nd * dot_nd);
  if (k < 0.0)
    return vec3(0.0); // total internal reflection
  return eta * rd - (eta * dot_nd + sqrt(k)) * n;
}

vec4 raymarch(inout vec3 p, vec3 rd, float init_dist, bool hit_sea, float t_sea_min, float t_sea_max) {
  #if DRAW_DE
    num_DEs = 0.0;
  #endif
  
  // analytically test the marble and the flag
  float an_t_marble = ray_sphere(p, rd, iMarblePos, iMarbleRad);
  float an_t_flag = ray_sphere(p, rd, flag_center, flag_radius);
  
  bool an_hit_marble = an_t_marble > 0.0;
  bool an_hit_flag = an_t_flag > 0.0;
  
  float d, min_dist;
  float t = init_dist;
  float prev_d = 0.0;
  closer_elem = 0;
  elem_hit = 0;
  
  p += rd * init_dist;
  
  for (int i = 0; i < uMaxSteps; i++) {
    d = de_scene(p, an_hit_marble, an_hit_flag);
    
    #if DRAW_DE
      num_DEs += 0.01;
    #endif
    min_dist = max(FOVperPixel * t, MIN_DIST);
    
    if (d < min_dist) {
      elem_hit = closer_elem;
      break;
    }
    
    t += d;
    
    #if SEA_ENABLED
      if (hit_sea && t_sea_min > 0.0 && t > t_sea_max) break;
    #endif
    if (t > depth_far) {
      t = 1e30;
      break;
    }
    
    p += rd * d;
    prev_d = d;
  }
  
  if (elem_hit == MARBLE) {
    t = an_t_marble;
  }
  
  return vec4(d, t, min_dist, prev_d);
}

vec2 raymarch_shadow_inv(vec3 p, vec3 rd, float init_dist, float sharpness) {
  #if DRAW_DE
    num_DEs = 0.0;
  #endif
  
  float max_depth;
  vec3 rel = p - light_pos;
  
  float lx = dot(rel, light_right);
  float ly = dot(rel, light_up);
  
  vec2 uv = vec2(
    lx / ortho_scale + 0.5,
    ly / ortho_scale + 0.5
  );
  
  float texture_depth;
  if (uv.x < 0.0 || uv.x > 1.0 ||
      uv.y < 0.0 || uv.y > 1.0) {
    max_depth = depth_far;
  } else {
    vec3 light_origin = light_pos +
      light_right * lx +
      light_up * ly;
    
    float light_dist = dot(p - light_origin, light_forward);
    texture_depth = texture(shadow_tex, uv).r;
    max_depth = light_dist - texture_depth;
    p += rd * max_depth; // set p on the shadow map
  }
  
  // analytically test the marble and the flag
  float radius_scale = 1.0 + (5.0 / shadow_sharpness);
  float an_t_marble = ray_sphere(p, -rd, iMarblePos, iMarbleRad * radius_scale);
  float an_t_flag = ray_sphere(p, -rd, flag_center, flag_radius);
  
  bool an_hit_marble = an_t_marble > 0.0;
  bool an_hit_flag = an_t_flag > 0.0;
  
  float t = init_dist;
  float min_d = 1.0;
  closer_elem_sh = 0;
  elem_hit_sh = 0;
  
  p += rd * init_dist;
  
  for (int i = 0; i < uMaxSteps; i++) {
    float d = de_scene_sh(p, an_hit_marble, an_hit_flag);
    
    #if DRAW_DE
      num_DEs += 0.01;
    #endif
    
    if (d < MIN_DIST) {
      elem_hit_sh = closer_elem_sh;
      break;
    }
    
    t += d;
    if (t > max_depth) break;
    p -= rd * d;
    min_d = min(min_d, sharpness * d / (max_depth - t));
  }
  
  t += texture_depth;
  
  return vec2(t, min_d);
}

float raymarch_shadow_marble(vec3 p, vec3 rd, float init_dist, float sharpness, float an_t_marble) {
  #if DRAW_DE
    num_DEs = 0.0;
  #endif
  
  // analytically test the flag
  float an_t_flag = ray_sphere(p, rd, flag_center, flag_radius);
  bool an_hit_flag = an_t_flag > 0.0;
  
  float t = init_dist;
  float min_d = 1.0;
  closer_elem_sh = 0;
  elem_hit_sh = 0;
  
  p += rd * init_dist;
  
  for (int i = 0; i < uMaxSteps; i++) {
    float d = de_scene_sh(p, false, an_hit_flag);
    
    #if DRAW_DE
      num_DEs += 0.01;
    #endif
    
    if (d < MIN_DIST) {
      elem_hit_sh = closer_elem_sh;
      break;
    }
    
    t += d;
    if (t > an_t_marble) {
      elem_hit_sh = MARBLE;
      break;
    }
    p += rd * d;
    min_d = min(min_d, sharpness * d / t);
  }
  
  return min_d;
}

#if RELAXED_RAYMARCH // same speed
  #define OMEGA 1.2
  
  vec4 relaxed_raymarch(inout vec3 p, vec3 rd, float init_dist, bool hit_sea, float t_sea_min, float t_sea_max) {
    #if DRAW_DE
      num_DEs = 0.0;
    #endif
    
    // analytically test the marble and the flag
    float an_t_marble = ray_sphere(p, rd, iMarblePos, iMarbleRad);
    float an_t_flag = ray_sphere(p, rd, flag_center, flag_radius);
    
    bool an_hit_marble = an_t_marble > 0.0;
    bool an_hit_flag = an_t_flag > 0.0;
    
    float d, min_dist;
    float t = init_dist;
    float prev_d = 0.0;
    closer_elem = 0;
    elem_hit = 0;
    bool relaxed = true;
    float z = 0.0;
    
    p += rd * init_dist;
    
    for (int i = 0; i < uMaxSteps; i++) {
      d = de_scene(p, an_hit_marble, an_hit_flag);
      
      #if DRAW_DE
        num_DEs += 0.01;
      #endif
      
      if (relaxed) {
        // if the current sphere doesn't overlap with the last one revert p and t to the last safe position
        if (z > prev_d + d) {
          t -= z - prev_d;
          p -= rd * (z - prev_d);
          relaxed = false;
          continue;
        }
        
        z = OMEGA * d; // relaxed dist
      } else {
        z = d;
      }
      
      min_dist = max(FOVperPixel * t, MIN_DIST);
      
      if (d < min_dist) {
        elem_hit = closer_elem;
        break;
      }
      
      t += z;
      
      #if SEA_ENABLED
        if (hit_sea && t_sea_min > 0.0 && t > t_sea_max) break;
      #endif
      if (t > depth_far) {
        t = 1e30;
        break;
      }
      
      p += rd * z;
      prev_d = d;
    }
    
    if (elem_hit == MARBLE) {
      t = an_t_marble;
    }
    
    return vec4(d, t, min_dist, prev_d);
  }
#endif

#if SHADOWS_ENABLED
  vec2 trace_marble(vec3 p, vec3 rd) {
    // Calculate refraction
    vec3 n = normalize(p - iMarblePos);
    #if 0 && ENABLE_SHADOW_SPARSE_RAYS
      // obtain the opposite p
      p += (dot(rd, -n) * 2.0 * iMarbleRad) * rd;
      n = normalize(p - iMarblePos);
      rd = -rd;
    #endif
    vec3 q = refract(rd, n, 1.0 / 1.5);
    // if (dot(q, q) <= 0.001)
    //   return vec2(1e30, 1.0);
    vec3 p2 = p + (dot(q, -n) * 2.0 * iMarbleRad) * q; // opposite side of the ball along q
    vec3 n2 = normalize(p2 - iMarblePos);
    // q = (dot(q, rd) * 2.0) * q - rd; // negative reflection, used on the original game instead of refract
    q = refract(q, -n2, 1.5);
    vec2 rm = raymarch_shadow_inv(p2, q, MIN_DIST_S, SHADOW_DARKNESS); // SHADOW_DARKNESS is not a typo, this produces the correct caustic size
    float focus = max(dot(q, rd), 0.0);
    float caustic = pow(focus, 40.0) * 2.0;
    rm.y += caustic;
    return rm;
  }
#endif

#if ENABLE_SHADOW_SPARSE_RAYS && VIEW_SHADOWMAP
  float shadow_lookup(vec3 p, float min_dist) {
    vec3 rel = p - light_pos;

    float lx = dot(rel, light_right);
    float ly = dot(rel, light_up);
    float lz = dot(rel, light_forward);

    vec2 uv = vec2(
      lx / ortho_scale + 0.5,
      ly / ortho_scale + 0.5
    );

    if (uv.x < 0.0 || uv.x > 1.0 ||
        uv.y < 0.0 || uv.y > 1.0)
      return 1.0;
    
    // float depth = dot(p - light_pos, light_forward);

    float shadow_depth = texture(shadow_tex, uv).r;
    float bias = 0.2;

    return (lz > shadow_depth + bias) ? 0.0 : 1.0;
  }
#endif

#if FULL_NORMAL
  vec3 frac_color(vec3 p, vec3 rd, vec3 n, float k, float min_dist, float prev_d) {
    vec3 color;
    vec3 base_color = col_scene(p);
    
    #if AO_ENABLED
      #if FULL_AO
        float ao = calcAO(p, n);
        ao = mix(1.0, ao, SHADOW_DARKNESS);
      #else
        float ao = clamp(prev_d / (min_dist * 10), 0.0, 1.0);
        ao = mix(1.0, ao, 0.5);
        // ao = pow(ao, 2.0);
      #endif
      vec3 ambient = base_color * AMBIENT_COLOR * ao;
    #else
      vec3 ambient = base_color * (1.0 - SHADOW_DARKNESS);
    #endif
    
    #if SHADOWS_ENABLED
      // if it's not in the shadow
      if (k > min_dist * 10) {
        // float ao = clamp(s * AO_SCALE, 0.0, 1.0);
        float diff = max(dot(n, lightdir_n), 0.0);
        vec3 diff_col = diff * base_color * LIGHT_COLOR * k;
        #if COLORED_GLASS_MARBLE
          if (elem_hit_sh == MARBLE) {
            diff_col *= MARBLE_COLOR;
          }
        #endif
        
        #if SPECULAR_ENABLED
          // half view vector
          vec3 half_view = normalize(lightdir_n - rd);
          float spec = pow(max(dot(n, half_view), 0.0), SPECULAR_SHININESS);
          vec3 spec_col = spec * LIGHT_COLOR * SPECULAR_STRENGTH * k;
          #if COLORED_GLASS_MARBLE
            if (elem_hit_sh == MARBLE) {
              spec_col *= MARBLE_COLOR;
            }
          #endif
          
          color = diff_col + spec_col + ambient;
        #else
          color = diff_col + ambient;
        #endif
      } else {
        color = ambient;
      }
    #else
      float diff = max(dot(n, lightdir_n), 0.0);
      vec3 diff_col = diff * base_color * LIGHT_COLOR;
      
      #if SPECULAR_ENABLED
        // half view vector
        vec3 half_view = normalize(lightdir_n - rd);
        float spec = pow(max(dot(n, half_view), 0.0), SPECULAR_SHININESS);
        vec3 spec_col = spec * LIGHT_COLOR * SPECULAR_STRENGTH;
        
        color = diff_col + spec_col + ambient;
      #else
        color = diff_col + ambient;
      #endif
    #endif
    
    return color;
  }
#else
  vec3 frac_color(vec3 p, vec3 rd, float k, float min_dist, float prev_d) {
    vec3 color;
    vec3 base_color = col_scene(p);
    
    #if AO_ENABLED
      float ao = clamp(prev_d / (min_dist * 10), 0.0, 1.0);
      ao = mix(1.0, ao, 0.5);
      // ao = pow(ao, 2.0);
      vec3 ambient = base_color * AMBIENT_COLOR * ao;
    #else
      vec3 ambient = base_color * AMBIENT_COLOR * (1.0 - SHADOW_DARKNESS);
    #endif
    
    #if SHADOWS_ENABLED
      // if it's not in the shadow
      if (k > min_dist * 10) {
        // pointing to the sun
        vec3 p_light = p + lightdir_n * min_dist;
        float d_light = de_scene(p_light);
        float diff = max((d_light - d) / min_dist, 0.0);
        vec3 diff_col = diff * base_color * LIGHT_COLOR * k;
        #if COLORED_GLASS_MARBLE
          if (elem_hit_sh == MARBLE) {
            diff_col *= MARBLE_COLOR;
          }
        #endif
        
        #if SPECULAR_ENABLED
          // half view vector
          vec3 p_half = p + normalize(lightdir_n - rd) * min_dist;
          float d_half = de_scene(p_half);
          float spec = pow(max((d_half - d) / min_dist, 0.0), SPECULAR_SHININESS);
          vec3 spec_col = spec * LIGHT_COLOR * SPECULAR_STRENGTH * k;
          #if COLORED_GLASS_MARBLE
            if (elem_hit_sh == MARBLE) {
              spec_col *= MARBLE_COLOR;
            }
          #endif
          
          color = diff_col + spec_col + ambient;
        #else
          color = diff_col + ambient;
        #endif
      } else {
        color = ambient;
      }
    #else
      // pointing to the sun
      vec3 p_light = p + lightdir_n * min_dist;
      float d_light = de_scene(p_light);
      float diff = max((d_light - d) / min_dist, 0.0);
      vec3 diff_col = diff * base_color * LIGHT_COLOR;
      
      #if SPECULAR_ENABLED
        // half view vector
        vec3 p_half = p + normalize(lightdir_n - rd) * min_dist;
        float d_half = de_scene(p_half);
        float spec = pow(max((d_half - d) / min_dist, 0.0), SPECULAR_SHININESS);
        vec3 spec_col = spec * LIGHT_COLOR * SPECULAR_STRENGTH;
        
        color = diff_col + spec_col + ambient;
      #else
        color = diff_col + ambient;
      #endif
    #endif
    
    return color;
  }
#endif

vec3 sky_color(vec3 rd) {
  #if SKY_ENABLED
    // sun-view angle
    float mu = dot(rd, lightdir_n);
    
    // up gradient
    float rayleigh = mix(0.3, 1.0, 1.0 - (rd.y * 0.5 + 0.5));
    // sun scattering
    float mie = pow(max(mu, 0.0), 32.0);
    
    // atmospheric thickness (horizon haze)
    float atmosphere = 1.0 / (abs(rd.y) + 0.15);
    
    vec3 sky = BACKGROUND_COLOR * rayleigh;
    sky += LIGHT_COLOR * mie * 0.6;
    
    // add haze toward horizon
    sky = mix(sky, HAZE_COLOR * 0.8, atmosphere * 0.25);
  #else
    vec3 sky = BACKGROUND_COLOR; // sky
  #endif
  
  // darkens the screen sides
  #if VIGNETTE_ENABLED
    sky *= 1.0 - VIGNETTE_STRENGTH * length(screen_pos - 0.5);
  #endif
  
  // background specular
  #if SUN_ENABLED
    float sun_spec = dot(rd, lightdir_n) - 1.0 + SUN_SIZE;
    sun_spec = min(exp(sun_spec * SUN_SHARPNESS / SUN_SIZE), 1.0);
    sky += LIGHT_COLOR * sun_spec;
  #endif
  
  return sky;
}

vec3 marble_color(vec3 p, vec3 rd) {
  vec3 color;
  #if MARBLE_DIFFUSE
    vec3 ambient = MARBLE_COLOR * AMBIENT_COLOR * (1.0 - SHADOW_DARKNESS);
    
    vec3 n = normalize(p - iMarblePos);
    float diff = max(dot(n, light_dir_n), 0.0);
    vec3 diff_col = diff * MARBLE_COLOR * LIGHT_COLOR;
    
    vec3 half_view = normalize(lightdir_n - rd);
    float spec = pow(max(dot(n, half_view), 0.0), SPECULAR_SHININESS);
    vec3 spec_col = spec * LIGHT_COLOR * SPECULAR_STRENGTH;
    
    color = diff_col + spec_col + ambient;
  #else
    vec3 n = normalize(p - iMarblePos);
    
    // Calculate reflection
    vec3 r = reflect(rd, n);
    vec3 p_refl = p + n * MIN_DIST_S;
    vec3 refl = scene(p_refl, r, 0.05, 0, cam_is_underwater);
    
    if (elem_hit == SEA) {
      #if !ENABLE_REFL_REFR_WATER
        refl = sea_surface_color(r_sea.p, r, cam_is_underwater);
      #else
        refl = waves_color(r_sea.p, r, cam_is_underwater);
      #endif
    }
    
    // Calculate refraction
    vec3 q = refract(rd, n, 1.0 / 1.5);
    
    vec3 refr;
    if (dot(q, q) > 0.0) {
      vec3 p2 = p + (dot(q, -n) * 2.0 * iMarbleRad) * q; // opposite side of the ball along q
      vec3 n2 = normalize(p2 - iMarblePos);
      // q = (dot(q, rd) * 2.0) * q - rd; // negative reflection
      q = refract(q, -n2, 1.5);
      vec3 p_refr = p2 + n2 * MIN_DIST_S;
      refr = scene(p_refr, q, MIN_DIST_S, 0, cam_is_underwater);
    } else {
      refr = refl;
    }
    
    if (elem_hit == SEA) {
      #if !ENABLE_REFL_REFR_WATER
        refr = sea_surface_color(r_sea.p, q, cam_is_underwater);
      #else
        refr = waves_color(r_sea.p, q, cam_is_underwater);
      #endif
    }
    
    float cos_theta = clamp(-dot(rd, n), 0.0, 1.0);
    const float F0 = 0.04;
    float fresnel = F0 + (1.0 - F0) * pow(1.0 - cos_theta, 5.0);
    
    #if !COLORED_GLASS_MARBLE
      color = refr * (1.0 - fresnel) + refl * fresnel;
    #else
      color = refr * MARBLE_COLOR * (1.0 - fresnel) + refl * fresnel;
    #endif
  #endif
  
  return color;
}

vec3 sea_color(vec3 rd) {
  float horizon = clamp(1.0 - abs(rd.y), 0.0, 1.0);
  return mix(SEA_COLOR, LIGHT_BLUE, pow(horizon, 2.0));
}

// the returned normal always point outside the water surface
// requires r_sea being set

vec3 get_waves_normal(bool p_is_underwater) {
  // return vec3(0.0, 1.0, 0.0); // flat reflections
  float c1 = cos(r_sea.a1);
  float c2 = cos(r_sea.a2);
  
  float dhdx = c1 * WAVE_X1 * WAVE_H1 + c2 * WAVE_X2 * WAVE_H2;
  float dhdz = c1 * WAVE_Z1 * WAVE_H1 - c2 * WAVE_Z2 * WAVE_H2;
  
  dhdx *= r_sea.fade;
  dhdz *= r_sea.fade;
  
  vec3 n = normalize(vec3(-dhdx, 1.0, -dhdz));
  if (p_is_underwater) return -n;
  return n;
}

#if !VOLUMETRIC_WAVES
  // distance to sea plane
  
  bool ray_sea_plane_hit(vec3 p, vec3 rd, out float t_sea) {
    if (abs(rd.y) < 1e-6) {
      t_sea = 1e30;
      return false;
    }
    
    t_sea  = (SEA_LEVEL - p.y) / rd.y;
    
    if (t_sea < 0.0) {
      t_sea = 1e30;
      return false;
    }
    
    return true;
  }
  
  // set r_sea
  
  void set_sea_plane_struct(vec3 p, vec3 rd) {
    if (abs(rd.y) < 1e-4) return;
    
    r_sea.t = (SEA_LEVEL - p.y) / rd.y;
    if (r_sea.t <= 0.0) return;
    
    r_sea.p = p + rd * r_sea.t;
    
    r_sea.a1 = r_sea.p.x * WAVE_X1 + r_sea.p.z * WAVE_Z1 + iTime * WAVE_T1;
    r_sea.a2 = r_sea.p.x * WAVE_X2 - r_sea.p.z * WAVE_Z2 + iTime * WAVE_T2;
    
    float s1 = sin(r_sea.a1);
    float s2 = sin(r_sea.a2);
    
    // fading the waves gets rid of the aliasing on the horizon
    r_sea.fade = 1.0 / (1.0 + r_sea.t * 0.15);
    
    float h = (s1 * WAVE_H1 + s2 * WAVE_H2) * r_sea.fade;
    
    // correct intersection
    r_sea.t += h / rd.y;
  }
#else
  // determine if it hit the sea slab
  // returns the distance to the closest and furthest slab planes
  
  bool ray_sea_slab_hit(vec3 p, vec3 rd, out float t_min, out float t_max) {
    // if the ray doesn't cross the slab
    if ((p.y >  MAX_SEA_HEIGHT && rd.y >= 0.0) ||
        (p.y < -MAX_SEA_HEIGHT && rd.y <= 0.0)) {
      t_min = 1e30;
      t_max = 1e30;
      return false;
    }
    
    float t1 = (-MAX_SEA_HEIGHT - p.y) / rd.y;
    float t2 = ( MAX_SEA_HEIGHT - p.y) / rd.y;

    t_min = min(t1, t2);
    t_max = max(t1, t2);

    if (p.y <= MAX_SEA_HEIGHT && p.y >= -MAX_SEA_HEIGHT) {
      t_min = 0.0;
    }
    return true;
  }
  
  // determine the wave height
  
  float wave_height(vec3 p, float t) {
    float a1 = p.x * WAVE_X1 + p.z * WAVE_Z1 + iTime * WAVE_T1;
    float a2 = p.x * WAVE_X2 - p.z * WAVE_Z2 + iTime * WAVE_T2;
    float fade = 1.0 / (1.0 + t * 0.15);
    return (sin(a1) * WAVE_H1 + sin(a2) * WAVE_H2) * fade;
  }
  
  // return if it hit a wave and set r_sea
  
  bool test_vol_sea_hit(vec3 p, vec3 rd, bool p_is_underwater) {
    float inv_rdy = 1.0 / (abs(rd.y) > 1e-4 ? rd.y : sign(rd.y) * 1e-4);
    
    // Intersect the ray with the wave slab
    float t_bot = (SEA_LEVEL - MAX_SEA_HEIGHT - p.y) * inv_rdy;
    float t_top = (SEA_LEVEL + MAX_SEA_HEIGHT - p.y) * inv_rdy;
    // rejects the sea behind p
    float t_min = max(min(t_bot, t_top), 0.0);
    float t_max = min(max(t_bot, t_top), 1e30); // sea max view distance
    if (t_max <= t_min) return false; // not sure if needed
    
    // Step through the slab until you find a sign change
    // make the number of steps depend on the ray angle, up/down = 8, horizon = 64
    float a = 1.0 - abs(rd.y);
    int steps = int(mix(8.0, 64.0, pow(a, 4.0))); // bias the steps towards the horizon
    float t = t_min;
    vec3 ps = p + rd * t;
    float h = wave_height(ps, t);
    float prev_f = ps.y - SEA_LEVEL - h;
    float prev_t = t_min;
    
    for (int i = 1; i <= steps; i++) {
      float u = float(i) / float(steps);
      
      // exponential distribution, makes the steps be more near the ray origin
      t = mix(t_min, t_max, pow(u, 4.0));
      
      ps = p + rd * t;
      h = wave_height(ps, t);
      float f = ps.y - SEA_LEVEL - h;
      
      if (i > 0 && prev_f * f < 0.0) {
        bool crossing_down = prev_f > 0.0 && f < 0.0;
        bool crossing_up   = prev_f < 0.0 && f > 0.0;
        
        if ((!p_is_underwater && !crossing_down) ||
            ( p_is_underwater && !crossing_up)) {
          prev_f = f;
          prev_t = t;
          continue;
        }
        
        // Bisect to refine the crossing
        float ta = prev_t;
        float tb = t;
        float fa = prev_f;
        
        for (int j = 0; j < 6; j++) {
          t = (ta + tb) * 0.5;
          ps = p + rd * t;
          h = wave_height(ps, t);
          f = ps.y - SEA_LEVEL - h;
          if (fa * f < 0.0) { tb = t; } else { ta = t; fa = f; }
        }
        
        // set the global variables
        r_sea.t = (ta + tb) * 0.5;
        r_sea.p = p + rd * r_sea.t;
        r_sea.a1 = r_sea.p.x * WAVE_X1 + r_sea.p.z * WAVE_Z1 + iTime * WAVE_T1;
        r_sea.a2 = r_sea.p.x * WAVE_X2 - r_sea.p.z * WAVE_Z2 + iTime * WAVE_T2;
        r_sea.fade = 1.0 / (1.0 + r_sea.t * 0.15);
        return true;
      }
      
      prev_f = f;
      prev_t = t;
    }
    
    return false;
  }
  
  bool test_if_underwater(vec3 p) {
    float a1 = p.x * WAVE_X1 + p.z * WAVE_Z1 + iTime * WAVE_T1;
    float a2 = p.x * WAVE_X2 - p.z * WAVE_Z2 + iTime * WAVE_T2;
    float h = sin(a1) * WAVE_H1 + sin(a2) * WAVE_H2;
    return p.y < SEA_LEVEL + h;
  }
#endif

#if !ENABLE_REFL_REFR_WATER
  vec3 sea_surface_color(vec3 p, vec3 rd, bool p_is_underwater) {
    vec3 sea;
    
    vec3 n = get_waves_normal(p_is_underwater);
    
    if (p_is_underwater) {
      vec3 r = reflect(rd, n);
      sea = sea_color(r);
      
      float fog = 1.0 - exp(-r_sea.t * 0.15);
      sea = mix(sea, LIGHT_BLUE, fog);
    } else {
      #if ENABLE_SHADOWS_ON_SEA
        // cast shadows on water
        // vec3 p_light = p + lightdir_n * MIN_DIST_S;
        
        vec2 rm = raymarch_shadow_inv(p, lightdir_n, MIN_DIST_S, shadow_sharpness);
        float shadow = rm.y * min(rm.x, 1.0);
        
        float sun_diff = max(dot(n, lightdir_n), 0.0) * shadow;
      #else
        float sun_diff = max(dot(n, lightdir_n), 0.0);
      #endif
      
      #if BLINN_PHONG_SEA
        vec3 half_view = normalize(lightdir_n - rd);
        float sun_spec = pow(max(dot(n, half_view), 0.0), 40.0);
      #else
        vec3 r = reflect(rd, n);
        float sun_spec = pow(max(dot(r, lightdir_n), 0.0), 40.0) * 2.0;
        vec3 refl = sky_color(r);
      #endif
      
      // fresnel
      float cos_theta = clamp(-dot(rd, n), 0.0, 1.0);
      float F0 = 0.02;
      float fresnel = F0 + (1.0 - F0) * pow(1.0 - cos_theta, 5.0);
      
      sea = mix(SEA_COLOR, refl, fresnel);
      
      sea += SEA_COLOR * sun_diff * 0.5;
      
      #if SHADOWS_ENABLED && ENABLE_SHADOWS_ON_SEA
        sea += LIGHT_COLOR * sun_spec * shadow;
      #else
        sea += LIGHT_COLOR * sun_spec;
      #endif
    }
    
    return sea;
  }
#else
  vec3 waves_surface_color(vec3 p, vec3 rd, vec3 n) {
    #if ENABLE_SHADOWS_ON_SEA
      // cast shadows on water
      // vec3 p_light = p + lightdir_n * MIN_DIST_S;
      
      vec2 rm = raymarch_shadow_inv(p, lightdir_n, MIN_DIST_S, shadow_sharpness);
      float shadow = rm.y * min(rm.x, 1.0);
      
      float sun_diff = max(dot(n, lightdir_n), 0.0) * shadow;
    #else
      float sun_diff = max(dot(n, lightdir_n), 0.0);
    #endif
    
    #if BLINN_PHONG_SEA
      vec3 half_view = normalize(lightdir_n - rd);
      float sun_spec = pow(max(dot(n, half_view), 0.0), 40.0);
    #else
      vec3 r = reflect(rd, n);
      float sun_spec = pow(max(dot(r, lightdir_n), 0.0), 40.0) * 2.0;
    #endif
    
    vec3 sea = SEA_COLOR * sun_diff * 0.5;
    
    #if SHADOWS_ENABLED && ENABLE_SHADOWS_ON_SEA
      sea += LIGHT_COLOR * sun_spec * shadow;
    #else
      sea += LIGHT_COLOR * sun_spec;
    #endif
    
    return sea;
  }
  
  vec3 waves_color(vec3 p, vec3 rd, bool p_is_underwater) {
    vec3 sea;
    
    vec3 n = get_waves_normal(p_is_underwater);
    
    // if underwater
    if (p_is_underwater) {
      #if ENABLE_REFL_REFR_WATER
        #if ENABLE_WATER_REFLECTION
          // reflection
          vec3 r = reflect(rd, n);
          
          #if !ENABLE_WATER_SEC_BOUNCE
            // make sure the ray goes underwater
            if (r.y > 0) r.y = -r.y;
          #endif
          
          vec3 refl = scene(p, r, MIN_DIST_S, 1, true);
          
          #if ENABLE_WATER_SEC_BOUNCE
            if (elem_hit == SEA) {
              vec3 n2 = get_waves_normal(true);
              // return vec3(n2 * 0.5 + 0.5); // colors the normals
              vec3 r2 = reflect(r, n2);
              if (r2.y > 0) r2.y = -r2.y;
              
              refl = scene(r_sea.p, r2, 0.05, 2, true);
            }
          #endif
        #else
          vec3 r = reflect(rd, n);
          vec3 refl = sea_color(r);
        #endif
        
        if (g_hit_scene) {
          float fog = 1.0 - exp(-t_scene * 0.15);
          refl = mix(refl, LIGHT_BLUE, fog);
        }
        
        #if ENABLE_WATER_REFRACTION
          // refraction
          vec3 q = refract(rd, n, 1.33);
          
          vec3 refr;
          if (dot(q, q) > 0.001) {
            refr = scene(p, q, MIN_DIST_S, 1, false);
            
            #if ENABLE_WATER_SEC_BOUNCE
              if (elem_hit == SEA) {
                vec3 n2 = get_waves_normal(false);
                vec3 r2 = reflect(q, n2);
                if (r2.y < 0) r2.y = -r2.y;
                
                refr = scene(r_sea.p, r2, 0.05, 2, false);
                
                refr += waves_surface_color(r_sea.p, q, n2);
              }
            #endif
            // if (!g_hit_scene) refr = sky_color(q);
          } else {
            refr = refl;
          }
        #else
          vec3 refr = refl;
        #endif
        
        // fresnel
        float cos_theta = clamp(-dot(rd, n), 0.0, 1.0);
        float F0 = 0.02;
        float fresnel = F0 + (1.0 - F0) * pow(1.0 - cos_theta, 5.0);
        
        sea = mix(refr, refl, fresnel);
      #else
        // reflection
        vec3 r = reflect(rd, n);
        sea = sea_color(r);
      #endif
      
      float fog = 1.0 - exp(-r_sea.t * 0.15);
      sea = mix(sea, LIGHT_BLUE, fog);
    } else { // over water
      #if ENABLE_REFL_REFR_WATER
        #if ENABLE_WATER_REFLECTION
          // reflection
          vec3 r = reflect(rd, n);
          
          #if !ENABLE_WATER_SEC_BOUNCE
            // make sure the ray goes overwater
            if (r.y < 0) r.y = -r.y;
          #endif
          
          vec3 refl = scene(p, r, MIN_DIST_S, 1, false);
          
          #if ENABLE_WATER_SEC_BOUNCE
            if (elem_hit == SEA) {
              vec3 n2 = get_waves_normal(false);
              // return vec3(n2 * 0.5 + 0.5);
              vec3 r2 = reflect(r, n2);
              if (r2.y < 0) r2.y = -r2.y;
              
              refl = scene(r_sea.p, r2, 0.05, 2, false);
            }
          #endif
          // if (!g_hit_scene) refl = sky_color(r);
        #else
          vec3 r = reflect(rd, n);
          vec3 refl = sky_color(r);
        #endif
        
        #if ENABLE_WATER_REFRACTION
          // refraction
          vec3 q = refract(rd, n, 1.0 / 1.33);
          
          vec3 refr;
          if (dot(q, q) > 0.001) {
            refr = scene(p, q, MIN_DIST_S, 1, true);
            
            #if ENABLE_WATER_SEC_BOUNCE
              if (elem_hit == SEA) {
                vec3 n2 = get_waves_normal(true);
                vec3 r2 = reflect(q, n2);
                
                refr = scene(r_sea.p, r2, 0.05, 2, true);
              }
            #endif
            // fade the fractal against the sea
            if (g_hit_scene) {
              float fog = 1.0 - exp(-t_scene * 0.15);
              refr = mix(refr, SEA_COLOR, fog);
            }/*  else {
              refr = SEA_COLOR;
            } */
          } else {
            refr = refl;
          }
        #else
          vec3 refr = refl;
        #endif
      #else
        // diffuse
        float sun_diff = max(dot(n, lightdir_n), 0.0);
        
        //specular reflection
        vec3 r = reflect(rd, n);
        float sun_spec = pow(max(dot(r, lightdir_n), 0.0), 40.0);
        vec3 refl = sky_color(r);
        vec3 refr = SEA_COLOR;
      #endif
      
      // fresnel
      float cos_theta = clamp(-dot(rd, n), 0.0, 1.0);
      float F0 = 0.02;
      float fresnel = F0 + (1.0 - F0) * pow(1.0 - cos_theta, 5.0);
      
      sea = mix(refr, refl, fresnel);
      
      sea += waves_surface_color(p, rd, n);
    }
    
    return sea;
  }
#endif

vec3 scene(vec3 p, vec3 rd, float init_dist, int ray_id, bool p_is_underwater) {
  #if VOLUMETRIC_WAVES
    float t_sea_min, t_sea_max;
  #else
    #define t_sea_max t_sea
    #define t_sea_min t_sea
    float t_sea;
  #endif
  bool hit_sea;
  
  
  #if SEA_ENABLED
    #if VOLUMETRIC_WAVES && ENABLE_WATER_SEC_BOUNCE
      if (ray_id < 2) {
    #else
      if (ray_id == 0) {
    #endif
      #if VOLUMETRIC_WAVES
        hit_sea = ray_sea_slab_hit(p, rd, t_sea_min, t_sea_max);
      #else
        hit_sea = ray_sea_plane_hit(p, rd, t_sea);
      #endif
    } else {
      hit_sea = false;
    }
  #endif
  
  vec3 init_p = p;
  
  #if RELAXED_RAYMARCH
    vec4 d_t_m_pd = relaxed_raymarch(p, rd, init_dist, hit_sea, t_sea_min, t_sea_max);
  #else
    vec4 d_t_m_pd = raymarch(p, rd, init_dist, hit_sea, t_sea_min, t_sea_max);
  #endif
  
  float d = d_t_m_pd.x;
  t_scene = d_t_m_pd.y;
  float min_dist = d_t_m_pd.z;
  float prev_d = d_t_m_pd.w;
  vec3 color;
  
  #if DEBUG_SPHERES
    if (elem_hit == MARBLE || elem_hit == FLAG) {
      return vec3(1.0, 0.0, 1.0); // magenta
    }
  #endif
  
  // if (t_scene > depth_far) t_scene = 1e30;
  
  #if SEA_ENABLED
    if (hit_sea && t_scene > t_sea_min) {
      // if the ray hits the sea
      #if VOLUMETRIC_WAVES && ENABLE_WATER_SEC_BOUNCE
        if (ray_id < 2) {
      #else
        if (ray_id == 0) {
      #endif
        #if VOLUMETRIC_WAVES
          if (test_vol_sea_hit(init_p, rd, p_is_underwater) && r_sea.t < t_scene) // initial p required for the first ray because of the depth buffer
        #endif
        {
          #if !VOLUMETRIC_WAVES
            set_sea_plane_struct(init_p, rd);
          #endif
          elem_hit = SEA;
          g_hit_scene = false;
          return vec3(0.0);
        }
      }
    }
  #endif
  
  if (elem_hit == MARBLE) {
    g_hit_scene = false;
    return vec3(0.0);
  }
  
  if (d < min_dist) {
    g_hit_scene = true;
    
    float k = 1.0; // fully bright
    #if SHADOWS_ENABLED
      #if VIEW_SHADOWMAP
        k = shadow_lookup(p, min_dist);
      #else
        // march from the shadowmap towards p
        
        float an_t_marble = ray_sphere(p, lightdir_n, iMarblePos, iMarbleRad);
        bool an_hit_marble = an_t_marble > 0.0;
        
        vec2 rm;
        if (!an_hit_marble) { // if it doesn't hit the marble
          rm = raymarch_shadow_inv(p, lightdir_n, min_dist * 10, shadow_sharpness);
          k = rm.y * min(rm.x, 1.0); // diffuse shadows, min_d * min(t, 1.0)
        } else {
          k = raymarch_shadow_marble(p, lightdir_n, min_dist * 10, shadow_sharpness, an_t_marble);
          
          if (elem_hit_sh == MARBLE) {
            vec3 p_entry = p + lightdir_n * an_t_marble; // put p on the marble surface
            rm = trace_marble(p_entry, lightdir_n);
            
            k *= rm.y * min(rm.x, 1.0);
          } else {
            k = 0.0; // prevents the caustic to go through the floor
          }
        }
        
        // calculate some wave shadows over the fractal
        #if SEA_ENABLED && ENABLE_WAVE_CAUSTICS
          // if p is underwater
          #if VOLUMETRIC_WAVES
            if (k > min_dist * 10 && test_vol_sea_hit(p, lightdir_n, p_is_underwater)) {
          #else
            if (k > min_dist * 10) {
              set_sea_plane_struct(p, lightdir_n);
          #endif
            vec3 n = get_waves_normal(p_is_underwater);
            
            float focus = max(dot(-n, lightdir_n), 0.0); // this value is always > 0.4 && < 0.7
            // float wave_shadow = pow(focus, 4.0) * 2.0;
            
            // enlarge the depth at where the shadows can reach
            float depth = 1.0 - min(r_sea.t / 4.0, 1.0);
            
            float wave_shadow = 1.0 - (focus * depth);
            // wave_shadow = mix(LIGHT_COLOR, wave_shadow, depth);
            k *= wave_shadow;
            // fragColor = vec4(wave_shadow, 0.0, 0.0, 1.0);
          }
        #endif
      #endif
    #endif
    
    #if FULL_NORMAL
      // Get the surface normal
      // vec3 n = calcNormal(p, min_dist * 0.5);
      vec3 n = fastNormal(p, d, min_dist * 0.5);
      
      // find closest surface point, without this we get weird coloring artifacts
      p -= n * d;
      
      color = frac_color(p, rd, n, k, min_dist, prev_d);
    #else
      color = frac_color(p, rd, k, min_dist, prev_d);
    #endif
    
    #if FOG_ENABLED
      float a = t / depth_far;
      color = (1.0 - a) * color + a * BACKGROUND_COLOR;
    #endif
    
    // fade the fractal against the sea
    if (p_is_underwater) {
      // float water_depth = max(SEA_LEVEL - init_p.y, 0.0);
      float depth_fade = exp(SEA_LEVEL - p.y * 0.15);
      
      float horizon = clamp(rd.y + 1.0, 0.0, 1.0); // up = 1.0, horizon = 1.0, down = 0.0
      float fog = 1.0 - exp(-t_scene * 0.15);
      vec3 sea_bg = mix(SEA_COLOR, LIGHT_BLUE, pow(horizon, 2.0));
      sea_bg *= depth_fade;
      color = mix(color, sea_bg, fog);
    }
  }
  #if SEA_ENABLED
    else if (p_is_underwater) {
      g_hit_scene = false;
      color = sea_color(rd);
    }
  #endif
  else {
    g_hit_scene = false;
    color = sky_color(rd);
  }
  
  return color;
}

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  
  vec2 uv = (vec2(pixel) - 0.5 * vec2(uResolution)) / float(uResolution.y);
  #if VIGNETTE_ENABLED
    screen_pos = vec2(pixel) / vec2(uResolution);
  #endif
  
  vec3 rd = normalize( // ray direction
    cam_forward * focal_len +
    cam_right * uv.x +
    cam_up * uv.y
  );
  
  FOVperPixel = 1.0 / max(float(uResolution.x), 900.0);
  
  #if ENABLE_SPARSE_RAYS
    ivec2 fr_grid_idx = pixel / uStride;
    float init_dist = texelFetch(depth_tex, fr_grid_idx, 0).r;
  #else
    float init_dist = depth_near;
  #endif
  
  #if DRAW_DE
    vec3 ro = cam_pos;
    raymarch(ro, rd, init_dist);
    fragColor = vec4(vec3(min(num_DEs, 1.0)), 1.0);
    return;
  #endif
  
  #if VOLUMETRIC_WAVES
    cam_is_underwater = test_if_underwater(cam_pos);
  #else
    cam_is_underwater = cam_pos.y < SEA_LEVEL;
  #endif
  
  vec3 p = cam_pos;
  vec3 s_color = scene(p, rd, init_dist, 0, cam_is_underwater);
  vec3 f_color;
  
  // Check if this is the glass marble
  if (elem_hit == MARBLE) {
    vec3 pm = p + rd * t_scene;
    f_color = marble_color(pm, rd);
  }
  #if SEA_ENABLED
    else if (elem_hit == SEA) {
      #if !ENABLE_REFL_REFR_WATER
        f_color = sea_surface_color(r_sea.p, rd, cam_is_underwater);
      #else
        f_color = waves_color(r_sea.p, rd, cam_is_underwater);
      #endif
    }
  #endif
  else {
    f_color = s_color;
  }
  
  #if OUTPUT_ENABLED
    fragColor = vec4(clamp(f_color, 0.0, 1.0), 1.0);
  #endif
}
