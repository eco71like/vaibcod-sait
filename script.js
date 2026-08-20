const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const progress = document.getElementById("progress");
if (progress) {
  window.addEventListener(
    "scroll",
    () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const value = max > 0 ? window.scrollY / max : 0;
      progress.style.width = `${value * 100}%`;
    },
    { passive: true }
  );
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);

document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 6) * 60}ms`;
  observer.observe(el);
});

const cursor = document.getElementById("cursor");
if (cursor && window.matchMedia("(pointer: fine)").matches) {
  document.body.classList.add("has-cursor");
  window.addEventListener(
    "pointermove",
    (event) => {
      cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    },
    { passive: true }
  );
}

function splitHeadline(el) {
  if (!el) return;

  let delay = 0.12;

  const wrapNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const word = document.createElement("span");
        word.className = "word";
        [...part].forEach((ch) => {
          const char = document.createElement("span");
          char.className = "char";
          char.textContent = ch;
          char.style.animationDelay = `${delay}s`;
          delay += 0.018;
          word.appendChild(char);
        });
        frag.appendChild(word);
      });
      node.replaceWith(frag);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      [...node.childNodes].forEach(wrapNode);
    }
  };

  [...el.childNodes].forEach(wrapNode);
}

if (!reduceMotion) {
  splitHeadline(document.getElementById("hero-title"));
}

function initThreads(container) {
  if (!container || reduceMotion) return;

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
  if (!gl) return;

  const vs = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fs = `
    precision highp float;
    uniform float iTime;
    uniform vec3 iResolution;
    uniform vec3 uColor;
    uniform float uAmplitude;
    uniform float uDistance;
    uniform vec2 uMouse;

    #define PI 3.1415926538
    const int u_line_count = 28;
    const float u_line_width = 7.0;
    const float u_line_blur = 10.0;

    float Perlin2D(vec2 P) {
      vec2 Pi = floor(P);
      vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
      vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
      Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
      Pt += vec2(26.0, 161.0).xyxy;
      Pt *= Pt;
      Pt = Pt.xzxz * Pt.yyww;
      vec4 hash_x = fract(Pt * (1.0 / 951.135664));
      vec4 hash_y = fract(Pt * (1.0 / 642.949883));
      vec4 grad_x = hash_x - 0.49999;
      vec4 grad_y = hash_y - 0.49999;
      vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y)
        * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
      grad_results *= 1.4142135623730950;
      vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy
        * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
      vec4 blend2 = vec4(blend, vec2(1.0 - blend));
      return dot(grad_results, blend2.zxzx * blend2.wwyy);
    }

    float pixel(float count, vec2 resolution) {
      return (1.0 / max(resolution.x, resolution.y)) * count;
    }

    float lineFn(vec2 st, float width, float perc, vec2 mouse, float time, float amplitude, float distance) {
      float split_offset = (perc * 0.4);
      float split_point = 0.1 + split_offset;
      float amplitude_normal = smoothstep(split_point, 0.7, st.x);
      float finalAmplitude = amplitude_normal * 0.5 * amplitude * (1.0 + (mouse.y - 0.5) * 0.2);
      float time_scaled = time / 10.0 + (mouse.x - 0.5) * 1.0;
      float blur = smoothstep(split_point, split_point + 0.05, st.x) * perc;
      float xnoise = mix(
        Perlin2D(vec2(time_scaled, st.x + perc) * 2.5),
        Perlin2D(vec2(time_scaled, st.x + time_scaled) * 3.5) / 1.5,
        st.x * 0.3
      );
      float y = 0.5 + (perc - 0.5) * distance + xnoise / 2.0 * finalAmplitude;
      float line_start = smoothstep(
        y + (width / 2.0) + (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        y,
        st.y
      );
      float line_end = smoothstep(
        y,
        y - (width / 2.0) - (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        st.y
      );
      return clamp((line_start - line_end) * (1.0 - smoothstep(0.0, 1.0, pow(perc, 0.3))), 0.0, 1.0);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / iResolution.xy;
      float line_strength = 1.0;
      for (int i = 0; i < u_line_count; i++) {
        float p = float(i) / float(u_line_count);
        line_strength *= (1.0 - lineFn(
          uv,
          u_line_width * pixel(1.0, iResolution.xy) * (1.0 - p),
          p,
          uMouse,
          iTime,
          uAmplitude,
          uDistance
        ));
      }
      float colorVal = 1.0 - line_strength;
      gl_FragColor = vec4(uColor * colorVal, colorVal);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(program, "iTime");
  const uRes = gl.getUniformLocation(program, "iResolution");
  const uColor = gl.getUniformLocation(program, "uColor");
  const uAmp = gl.getUniformLocation(program, "uAmplitude");
  const uDist = gl.getUniformLocation(program, "uDistance");
  const uMouse = gl.getUniformLocation(program, "uMouse");

  gl.uniform3f(uColor, 0.839, 1.0, 0.294);
  gl.uniform1f(uAmp, 1.15);
  gl.uniform1f(uDist, 0.18);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const mouse = [0.5, 0.5];
  const target = [0.5, 0.5];
  let visible = true;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform3f(uRes, canvas.width, canvas.height, canvas.width / canvas.height);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  window.addEventListener(
    "pointermove",
    (e) => {
      const rect = container.getBoundingClientRect();
      target[0] = (e.clientX - rect.left) / rect.width;
      target[1] = 1 - (e.clientY - rect.top) / rect.height;
    },
    { passive: true }
  );

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  });
  io.observe(container);

  function frame(t) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    mouse[0] += 0.05 * (target[0] - mouse[0]);
    mouse[1] += 0.05 * (target[1] - mouse[1]);
    gl.uniform1f(uTime, t * 0.001);
    gl.uniform2f(uMouse, mouse[0], mouse[1]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  requestAnimationFrame(frame);
}

initThreads(document.getElementById("threads"));

const portrait = document.querySelector(".portrait");
if (portrait && !reduceMotion) {
  window.addEventListener(
    "scroll",
    () => {
      const rect = portrait.getBoundingClientRect();
      const offset = (window.innerHeight / 2 - (rect.top + rect.height / 2)) * 0.08;
      portrait.style.translate = `0 ${offset}px`;
    },
    { passive: true }
  );
}

if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
  document.querySelectorAll(".tilt").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -7;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 7;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  });

  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.28;
      const y = (e.clientY - r.top - r.height / 2) * 0.28;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener("pointerleave", () => {
      btn.style.transform = "";
    });
  });
}

function getNoRotationTransform(transformStr) {
  if (/rotate\([\s\S]*?\)/.test(transformStr)) {
    return transformStr.replace(/rotate\([\s\S]*?\)/, "rotate(0deg)");
  }
  if (transformStr === "none") return "rotate(0deg)";
  return `${transformStr} rotate(0deg)`;
}

function getPushedTransform(baseTransform, offsetX) {
  const translateRegex = /translate\(([-0-9.]+)px\)/;
  const match = baseTransform.match(translateRegex);
  if (match) {
    const newX = parseFloat(match[1]) + offsetX;
    return baseTransform.replace(translateRegex, `translate(${newX}px)`);
  }
  return baseTransform === "none" ? `translate(${offsetX}px)` : `${baseTransform} translate(${offsetX}px)`;
}

function initBounceCards(container) {
  if (!container || typeof gsap === "undefined") return;

  const cards = [...container.querySelectorAll(".bounce-card")];
  const canHover = window.matchMedia("(pointer: fine)").matches && !reduceMotion;

  if (!reduceMotion) {
    gsap.set(cards, { scale: 0 });
    const play = () => {
      gsap.to(cards, {
        scale: 1,
        stagger: 0.05,
        delay: 0.4,
        ease: "elastic.out(1, 0.5)",
        overwrite: "auto",
      });
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          play();
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(container);
  }

  if (!canHover) return;

  const pushSiblings = (hoveredIdx) => {
    cards.forEach((card, i) => {
      gsap.killTweensOf(card);
      const baseTransform = card.dataset.transform || "none";
      if (i === hoveredIdx) {
        gsap.to(card, {
          transform: getNoRotationTransform(baseTransform),
          duration: 0.4,
          ease: "back.out(1.4)",
          overwrite: "auto",
        });
        return;
      }
      const offsetX = i < hoveredIdx ? -136 : 136;
      gsap.to(card, {
        transform: getPushedTransform(baseTransform, offsetX),
        duration: 0.4,
        ease: "back.out(1.4)",
        delay: Math.abs(hoveredIdx - i) * 0.05,
        overwrite: "auto",
      });
    });
  };

  const resetSiblings = () => {
    cards.forEach((card) => {
      gsap.killTweensOf(card);
      gsap.to(card, {
        transform: card.dataset.transform || "none",
        duration: 0.4,
        ease: "back.out(1.4)",
        overwrite: "auto",
      });
    });
  };

  cards.forEach((card, idx) => {
    card.addEventListener("mouseenter", () => pushSiblings(idx));
    card.addEventListener("mouseleave", resetSiblings);
  });
}

initBounceCards(document.getElementById("bounce-cards"));
