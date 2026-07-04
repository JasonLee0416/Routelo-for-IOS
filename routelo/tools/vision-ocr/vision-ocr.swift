#!/usr/bin/env swift
//
// Apple Vision OCR — standalone macOS CLI.
// Runs the SAME VNRecognizeTextRequest configuration as the app's native module
// (modules/apple-vision-ocr) directly on macOS, so you can measure Apple Vision
// recognition on the receipt images WITHOUT building the app or booting a
// simulator. Vision.framework is native to macOS.
//
// Usage (from repo root, macOS 13+ for Korean):
//   swift routelo/tools/vision-ocr/vision-ocr.swift KakaoTalk_*.jpg \
//     > routelo/docs/ocr-benchmark/2026-07-04/vision-results.json
//
// Output: JSON array [{ image, imageWidth, imageHeight, processingMs, osVersion,
//   lines: [{ text, confidence, box: { x, y, w, h } }] }]  (box: normalized, bottom-left)
//
import Foundation
import Vision
import CoreGraphics
import ImageIO

let domainWords = [
  "발주화원", "배송화원", "발주처", "배송처", "수주화원",
  "수령인", "인수자", "받는분", "보내는분",
  "배송주소", "배달주소", "배송지", "도착지", "배달장소",
  "배송일", "배달일", "엄수", "예식", "본식",
  "리본문구", "경조사어", "축하화환", "근조화환",
  "상품명", "품명", "배송상품", "수량", "연락처", "핸드폰", "인수증",
]

func supportedLanguages(_ request: VNRecognizeTextRequest, _ desired: [String]) -> [String] {
  let supported = (try? request.supportedRecognitionLanguages()) ?? []
  let filtered = desired.filter { supported.contains($0) }
  return filtered.isEmpty ? ["en-US"] : filtered
}

func loadImage(_ path: String) -> (CGImage, CGImagePropertyOrientation)? {
  let url = URL(fileURLWithPath: path)
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return nil }
  let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any]
  let raw = (props?[kCGImagePropertyOrientation] as? UInt32) ?? 1
  return (img, CGImagePropertyOrientation(rawValue: raw) ?? .up)
}

func orientedSize(_ img: CGImage, _ o: CGImagePropertyOrientation) -> (Int, Int) {
  switch o {
  case .left, .leftMirrored, .right, .rightMirrored:
    return (img.height, img.width)
  default:
    return (img.width, img.height)
  }
}

func recognize(_ path: String) -> [String: Any] {
  let name = (path as NSString).lastPathComponent
  let start = Date()
  guard let (cg, orientation) = loadImage(path) else {
    return ["image": name, "error": "unable to load image", "lines": []]
  }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  request.customWords = domainWords
  request.recognitionLanguages = supportedLanguages(request, ["ko-KR", "en-US"])
  let handler = VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:])
  do { try handler.perform([request]) } catch {
    return ["image": name, "error": "\(error)", "lines": []]
  }
  let (w, h) = orientedSize(cg, orientation)
  var lines: [[String: Any]] = []
  for obs in (request.results ?? []) {
    guard let c = obs.topCandidates(1).first else { continue }
    let text = c.string.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.isEmpty { continue }
    let b = obs.boundingBox
    lines.append([
      "text": text,
      "confidence": Double(c.confidence),
      "box": ["x": Double(b.origin.x), "y": Double(b.origin.y),
              "w": Double(b.size.width), "h": Double(b.size.height)],
    ])
  }
  let os = ProcessInfo.processInfo.operatingSystemVersion
  FileHandle.standardError.write(
    "[vision] \(name)  lines=\(lines.count)  \(Int(Date().timeIntervalSince(start) * 1000))ms\n"
      .data(using: .utf8)!)
  return [
    "image": name,
    "imageWidth": w,
    "imageHeight": h,
    "processingMs": Int(Date().timeIntervalSince(start) * 1000),
    "osVersion": "\(os.majorVersion).\(os.minorVersion)",
    "lines": lines,
  ]
}

let paths = Array(CommandLine.arguments.dropFirst())
if paths.isEmpty {
  FileHandle.standardError.write("usage: swift vision-ocr.swift <image>...\n".data(using: .utf8)!)
  exit(2)
}
let results = paths.map(recognize)
let data = try JSONSerialization.data(
  withJSONObject: results, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
