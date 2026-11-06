import { afterEach, describe, expect, it, vi } from "vitest";
import { startHomeAmbience } from "./home-ambience";

afterEach(() => vi.unstubAllGlobals());

describe("homepage ambience", () => {
  it("loops the supplied trailer file and stops it when leaving the homepage", () => {
    const audio = {
      loop: false,
      volume: 1,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    };
    const Audio = vi.fn(function (source: string) {
      expect(source).toBe("/sound-effect/sound-bg-horror-trailer.mp3");
      return audio;
    });
    const document = new EventTarget();
    Object.defineProperty(document, "hidden", { value: false });
    vi.stubGlobal("Audio", Audio);
    vi.stubGlobal("document", document);

    const stop = startHomeAmbience();
    expect(Audio).toHaveBeenCalledOnce();
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBeLessThan(1);
    expect(audio.play).toHaveBeenCalledOnce();
    stop();
    expect(audio.pause).toHaveBeenCalledOnce();
  });
});
