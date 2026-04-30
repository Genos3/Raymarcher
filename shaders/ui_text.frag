#version 430 core

in vec2 v_uv;
out vec4 out_color;

uniform sampler2D uTextTex;
uniform vec2 uScreenSize;
uniform vec2 uTextPos;   // pixels (top-left)
uniform vec2 uTextSize;  // pixels

void main() {
  vec2 frag_px = v_uv * uScreenSize;
  frag_px.y = uScreenSize.y - frag_px.y; // flip y

  vec2 local = frag_px - uTextPos;
  if (local.x < 0.0 || local.y < 0.0 ||
      local.x >= uTextSize.x || local.y >= uTextSize.y)
    discard;

  vec2 uv = local / uTextSize;
  out_color = texture(uTextTex, uv);
}
