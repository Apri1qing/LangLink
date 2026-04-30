/**
 * 把 qwen-vl-ocr advanced_recognition 返回的 location 数组
 * `[x1,y1, x2,y2, x3,y3, x4,y4]`（原图像素，顺序：左上→右上→右下→左下）
 * 映射为容器百分比定位 `{ left, top, width, height }`。
 *
 * imageWidth/imageHeight 是**原图**的像素尺寸（base64 解码后的自然宽高）。
 * 百分比结果可直接用于 `position: absolute; left: X%; top: Y%; width: W%; height: H%`。
 *
 * 忽略旋转角度（取 bbox 的轴对齐外接矩形），满足 v1.4 MVP 需求。
 */
export interface BboxPercent {
  left: number
  top: number
  width: number
  height: number
}

export function locationToPercent(
  location: number[],
  imageWidth: number,
  imageHeight: number,
): BboxPercent | null {
  if (!Array.isArray(location) || location.length !== 8) return null
  if (!imageWidth || !imageHeight) return null

  const xs = [location[0], location[2], location[4], location[6]]
  const ys = [location[1], location[3], location[5], location[7]]
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)

  const rawLeft = (xMin / imageWidth) * 100
  const rawTop = (yMin / imageHeight) * 100
  const rawWidth = ((xMax - xMin) / imageWidth) * 100
  const rawHeight = ((yMax - yMin) / imageHeight) * 100

  if (!Number.isFinite(rawLeft) || !Number.isFinite(rawTop)) return null
  const left = clamp(rawLeft, 0, 100)
  const top = clamp(rawTop, 0, 100)
  return {
    left,
    top,
    width: clamp(rawWidth, 0, 100 - left),
    height: clamp(rawHeight, 0, 100 - top),
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
