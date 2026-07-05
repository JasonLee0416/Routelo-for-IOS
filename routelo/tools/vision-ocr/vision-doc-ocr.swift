// Apple Vision — Document transcript recognition (macOS CLI).
// Uses the new Swift Vision `RecognizeDocumentsRequest` (iOS 18 / macOS 15+).
//
// Experiment result on our receipts: `document.tables` is EMPTY — Apple Vision does
// NOT detect a table structure on these noisy/borderless KakaoTalk receipts, so the
// row/cell pairing we hoped for is unavailable. What remains is `document.text.transcript`,
// which MAY order lines better than our current `VNRecognizeTextRequest` output.
// This CLI outputs ONLY the transcript so we can diff it against vision-results.json.
//
// Usage (from repo root, macOS 15+; your OS 26.x qualifies):
//   swift routelo/tools/vision-ocr/vision-doc-ocr.swift KakaoTalk_*.jpg > doc-results.json
//
import Foundation
import Vision

@available(macOS 15.0, *)
func recognizeDocument(_ path: String) async -> [String: Any] {
  let name = (path as NSString).lastPathComponent
  let url = URL(fileURLWithPath: path)
  let request = RecognizeDocumentsRequest()
  do {
    let observations = try await request.perform(on: url)
    guard let document = observations.first?.document else {
      return ["image": name, "error": "no document observation", "transcript": "", "tableCount": 0]
    }

    let transcript = document.text.transcript
    let tableCount = document.tables.count
    let lines = transcript
      .split(separator: "\n", omittingEmptySubsequences: false)
      .map { String($0) }

    FileHandle.standardError.write(
      "[doc] \(name)  tables=\(tableCount)  lines=\(lines.count)  chars=\(transcript.count)\n"
        .data(using: .utf8)!)

    return [
      "image": name,
      "transcript": transcript,
      "lines": lines,
      "tableCount": tableCount,
    ]
  } catch {
    return ["image": name, "error": "\(error)", "transcript": "", "tableCount": 0]
  }
}

let paths = Array(CommandLine.arguments.dropFirst())
if paths.isEmpty {
  FileHandle.standardError.write("usage: swift vision-doc-ocr.swift <image>...\n".data(using: .utf8)!)
  exit(2)
}

if #available(macOS 15.0, *) {
  let sema = DispatchSemaphore(value: 0)
  var results: [[String: Any]] = []
  Task {
    for path in paths { results.append(await recognizeDocument(path)) }
    sema.signal()
  }
  sema.wait()
  let data = try JSONSerialization.data(
    withJSONObject: results, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write("\n".data(using: .utf8)!)
} else {
  FileHandle.standardError.write("RecognizeDocumentsRequest needs macOS 15+\n".data(using: .utf8)!)
  exit(2)
}
