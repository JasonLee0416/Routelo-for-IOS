import Foundation
import Vision
import CoreGraphics
import ImageIO

// On-device receipt OCR via Apple Vision (VNRecognizeTextRequest).
// Returns raw Vision coordinates (normalized, bottom-left origin); the JS layer
// (`app/platform/appleVision.ts`) converts them to the shared pixel/top-left
// contract so the mapping stays unit-testable.
@objc(AppleVisionOcr)
class AppleVisionOcr: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(recognizeText:resolver:rejecter:)
  func recognizeText(
    _ uri: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        resolve(try AppleVisionOcr.recognize(uri: uri))
      } catch {
        reject("APPLE_VISION_OCR", error.localizedDescription, error)
      }
    }
  }

  // Domain vocabulary improves recognition of Korean flower-delivery receipt
  // labels. Extend as new receipt templates appear.
  private static let domainWords = [
    "발주화원", "배송화원", "발주처", "배송처", "수주화원",
    "수령인", "인수자", "받는분", "보내는분",
    "배송주소", "배달주소", "배송지", "도착지", "배달장소",
    "배송일", "배달일", "엄수", "예식", "본식",
    "리본문구", "경조사어", "축하화환", "근조화환",
    "상품명", "품명", "배송상품", "수량", "연락처", "핸드폰", "인수증",
  ]

  private static func recognize(uri: String) throws -> [String: Any] {
    let start = Date()
    guard let (cgImage, orientation) = loadImage(uri: uri) else {
      throw NSError(
        domain: "AppleVisionOcr", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Unable to load receipt image at \(uri)."]
      )
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.customWords = domainWords
    request.recognitionLanguages = supportedLanguages(for: request, desired: ["ko-KR", "en-US"])

    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
    try handler.perform([request])

    // Vision boxes are normalized to the *oriented* image, so report oriented dims.
    let (width, height) = orientedSize(cgImage: cgImage, orientation: orientation)

    var lines: [[String: Any]] = []
    for observation in (request.results ?? []) {
      guard let candidate = observation.topCandidates(1).first else { continue }
      let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
      if text.isEmpty { continue }
      let box = observation.boundingBox // normalized, bottom-left origin
      lines.append([
        "text": text,
        "confidence": Double(candidate.confidence),
        "box": [
          "x": Double(box.origin.x),
          "y": Double(box.origin.y),
          "w": Double(box.size.width),
          "h": Double(box.size.height),
        ],
      ])
    }

    let os = ProcessInfo.processInfo.operatingSystemVersion
    return [
      "imageWidth": width,
      "imageHeight": height,
      "processingMs": Int(Date().timeIntervalSince(start) * 1000),
      "osVersion": "\(os.majorVersion).\(os.minorVersion)",
      "lines": lines,
    ]
  }

  private static func supportedLanguages(
    for request: VNRecognizeTextRequest, desired: [String]
  ) -> [String] {
    let supported = (try? request.supportedRecognitionLanguages()) ?? []
    let filtered = desired.filter { supported.contains($0) }
    return filtered.isEmpty ? ["en-US"] : filtered
  }

  private static func loadImage(uri: String) -> (CGImage, CGImagePropertyOrientation)? {
    let url = URL(string: uri) ?? URL(fileURLWithPath: uri)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
      return nil
    }
    let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
    let raw = (props?[kCGImagePropertyOrientation] as? UInt32) ?? 1
    let orientation = CGImagePropertyOrientation(rawValue: raw) ?? .up
    return (image, orientation)
  }

  private static func orientedSize(
    cgImage: CGImage, orientation: CGImagePropertyOrientation
  ) -> (Int, Int) {
    switch orientation {
    case .left, .leftMirrored, .right, .rightMirrored:
      return (cgImage.height, cgImage.width) // 90/270° swaps axes
    default:
      return (cgImage.width, cgImage.height)
    }
  }
}
