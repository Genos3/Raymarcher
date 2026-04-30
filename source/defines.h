#define ENABLE_SPARSE_RAYS 1

#define WINDOW_W 960 // 640, 960, 1280, 1920
#define WINDOW_H 540 // 360, 540, 720, 1080

#define ENABLE_VSYNC 0

#define DEPTH_NEAR 0.004
#define DEPTH_FAR 30.0

#define START_LEVEL 1
#define NUM_LEVELS 4

#define SCALE_WINDOW 0
#define SCALE 2

#define STRIDE 4 // space between the sparse rays
#define NUM_RAYS_X ((WINDOW_W + STRIDE - 1) / STRIDE)
#define NUM_RAYS_Y ((WINDOW_H + STRIDE - 1) / STRIDE)
#define MAX_STEPS 512 // 512

#define SHADOWS_ENABLED 1

#define ORTHO_SCALE 14.0f
#define SHADOW_SHARPNESS 20.0
#define SHADOW_MAP_SIZE 256

#define LIGHT_DIRECTION (vec3_t){0.5f, 0.5f, -0.5f}