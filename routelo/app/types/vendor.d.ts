declare module 'jpeg-js' {
  export type DecodedImage = {
    width: number;
    height: number;
    data: Uint8Array;
  };

  export function decode(
    data: Uint8Array,
    options?: { useTArray?: boolean; formatAsRGBA?: boolean },
  ): DecodedImage;
}
