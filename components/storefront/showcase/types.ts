/** Minimal data the WebGL stage needs for one product — resolved by the wrapper
 *  from a ShowcaseDisplayItem (prefers the bg-removed cutout `imagePng`, falls
 *  back to `image`). Kept tiny so the engine stays decoupled from query shapes. */
export type ShowcaseSceneItem = {
  id: string;
  src: string;
  animation: string;
  background: string;
  rotationSpeed: number;
  floatIntensity: number;
  zoom: number;
};
