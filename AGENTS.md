# Project architecture
- Keep the LightField as the single delegated DOM light controller; this limits pointer work and gives surfaces one shared interaction source.
- Keep ChronosGPU as the optional GPU optics layer with CSS material fallbacks; some browsers cannot provide WebGPU or WebGL2.