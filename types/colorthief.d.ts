/** colorthief 自带的 types 指向 Node API，这里覆盖为浏览器类 API。 */
declare module "colorthief" {
  export type RGBColor = [number, number, number];

  export type ImageSource =
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageData
    | ImageBitmap;

  export interface ColorThiefOptions {
    colorCount?: number;
    quality?: number;
    ignoreWhite?: boolean;
    whiteThreshold?: number;
    alphaThreshold?: number;
    minSaturation?: number;
  }

  export default class ColorThief {
    getColor(sourceImage: ImageSource, quality?: number): RGBColor | null;
    getColor(
      sourceImage: ImageSource,
      options?: ColorThiefOptions,
    ): RGBColor | null;
    getPalette(
      sourceImage: ImageSource,
      colorCount?: number,
      quality?: number,
    ): RGBColor[] | null;
    getPalette(
      sourceImage: ImageSource,
      options?: ColorThiefOptions,
    ): RGBColor[] | null;
  }
}
