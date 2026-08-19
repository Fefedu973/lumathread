# Single-frame matrix revision 2

The benchmark-only renderer hook now suppresses autonomous invalidation while paused and cancels any residual RAF before `debug.step`. Every result is rejected unless both builds report exactly one path composite, one glass composite, and one `gl.finish` per measured frame.
