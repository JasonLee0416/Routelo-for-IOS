import Foundation
import UIKit

// Minimal replacement for the expo-image-manipulator subset the OCR pipeline
// uses: sequential crop/resize actions on a local image, returned as base64
// JPEG. EXIF orientation is baked in before any action so crop coordinates
// from JS (which reasons in displayed/oriented space) stay correct.
@objc(RouteloImageOps)
class RouteloImageOps: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  // actions: array of { resize: { width, height } } | { crop: { originX, originY, width, height } }
  @objc(manipulate:actions:compress:resolver:rejecter:)
  func manipulate(
    _ uri: String,
    actions: NSArray,
    compress: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        var image = try RouteloImageOps.loadNormalized(uri: uri)
        for case let action as [String: Any] in actions {
          if let crop = action["crop"] as? [String: Any] {
            image = try RouteloImageOps.crop(image, spec: crop)
          } else if let resize = action["resize"] as? [String: Any] {
            image = try RouteloImageOps.resize(image, spec: resize)
          }
        }
        guard let jpeg = image.jpegData(compressionQuality: CGFloat(compress)) else {
          throw RouteloImageOps.error("Unable to encode image as JPEG.")
        }
        resolve([
          "base64": jpeg.base64EncodedString(),
          "width": Int(image.size.width.rounded()),
          "height": Int(image.size.height.rounded()),
        ])
      } catch {
        reject("ROUTELO_IMAGE_OPS", error.localizedDescription, error)
      }
    }
  }

  private static func error(_ message: String) -> NSError {
    NSError(
      domain: "RouteloImageOps", code: 1,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }

  // Loads the image and bakes EXIF orientation into the pixel data (scale 1 so
  // point and pixel dimensions match).
  private static func loadNormalized(uri: String) throws -> UIImage {
    let url = uri.contains("://")
      ? (URL(string: uri) ?? URL(fileURLWithPath: uri))
      : URL(fileURLWithPath: uri)
    let data = try Data(contentsOf: url)
    guard let image = UIImage(data: data) else {
      throw error("Unable to load image at \(uri).")
    }
    if image.imageOrientation == .up && image.scale == 1 { return image }
    return render(size: image.size) { _ in
      image.draw(in: CGRect(origin: .zero, size: image.size))
    }
  }

  private static func crop(_ image: UIImage, spec: [String: Any]) throws -> UIImage {
    guard let cgImage = image.cgImage else { throw error("Image has no bitmap data.") }
    let rect = CGRect(
      x: (spec["originX"] as? Double) ?? 0,
      y: (spec["originY"] as? Double) ?? 0,
      width: (spec["width"] as? Double) ?? Double(cgImage.width),
      height: (spec["height"] as? Double) ?? Double(cgImage.height)
    ).intersection(CGRect(x: 0, y: 0, width: cgImage.width, height: cgImage.height))
    guard !rect.isEmpty, let cropped = cgImage.cropping(to: rect) else {
      throw error("Crop rectangle is outside the image bounds.")
    }
    return UIImage(cgImage: cropped)
  }

  private static func resize(_ image: UIImage, spec: [String: Any]) throws -> UIImage {
    let size = CGSize(
      width: (spec["width"] as? Double) ?? Double(image.size.width),
      height: (spec["height"] as? Double) ?? Double(image.size.height)
    )
    guard size.width >= 1, size.height >= 1 else {
      throw error("Resize dimensions must be at least 1x1.")
    }
    return render(size: size) { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
  }

  private static func render(
    size: CGSize, actions: (UIGraphicsImageRendererContext) -> Void
  ) -> UIImage {
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = false
    return UIGraphicsImageRenderer(size: size, format: format).image(actions: actions)
  }
}
