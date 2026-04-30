#version 430 core

#define SCALE 1

layout(binding = 0) uniform sampler2D depth_tex;

out vec4 fragColor;

uniform ivec2 uResolution;
uniform float depth_far;

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  
  if (pixel.x >= uResolution.x || pixel.y >= uResolution.y)
    discard;
  
  ivec2 depthSize = textureSize(depth_tex, 0);
  ivec2 previewSize = depthSize * SCALE;
  
  ivec2 origin = ivec2(uResolution.x - previewSize.x,
                       uResolution.y - previewSize.y);
  
  if (pixel.x < origin.x || pixel.y < origin.y)
    discard;
  
  ivec2 local = pixel - origin;
  ivec2 depthCoord = local / SCALE;
  
  if (depthCoord.x >= depthSize.x ||
      depthCoord.y >= depthSize.y)
    discard;
  
  float d = texelFetch(depth_tex, depthCoord, 0).r;
  
  float v;
  if (d < 0.0)
    v = 0.0;
  else
    v = clamp(d / depth_far, 0.0, 1.0);

  fragColor = vec4(v, v, v, 1.0);
}
