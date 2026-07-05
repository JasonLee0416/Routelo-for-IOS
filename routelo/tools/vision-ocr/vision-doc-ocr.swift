// Apple Vision — Document/Table structure recognition (macOS CLI).
// Uses the new Swift Vision `RecognizeDocumentsRequest` (iOS 18 / macOS 15+) to
// detect TABLES and return text grouped by row/cell — so "발주화원 | (주)99플라워 | 070..."
// arrives already paired by table row, bypassing our heuristic layout reconstruction.
//
// Usage (from repo root, macOS 15+; your OS 26.x qualifies):
//   swift routelo/tools/vision-ocr/vision-doc-ocr.swift KakaoTalk_*.jpg > doc-results.json
//
// NOTE: this is the newest Swift-only Vision API. Property names below are best-effort;
// if the compiler complains, paste the error and we'll match your SDK's exact signatures.
//
import Foundation
import Vision

@available(macOS 15.0, *)
func recognizeDocument(_ path: String) async -> [String: Any] {
  let name = (path as NSString).lastPathComponent
  let url = URL(fileURLWithPath: path)
  let request = RecognizeDocumentsRequest()
  do {
    // New async perform. Returns [DocumentObservation].
    let observations = try await request.perform(on: url)
    guard let document = observations.first?.document else {
      return ["image": name, "error": "no document observation", "tables": [], "fullText": ""]
    }

    // Full transcript (safety fallback for the parser).
    let fullText = document.text.transcript

    // Tables → rows/cells with indices.
    var tables: [[String: Any]] = []
    for table in document.tables {
      var cells: [[String: Any]] = []
      for cell in table.cells {
        cells.append([
          "row": cell.rowIndexRange.lowerBound,
          "col": cell.columnIndexRange.lowerBound,
          "text": cell.content.text.transcript
            .trimmingCharacters(in: .whitespacesAndNewlines),
        ])
      }
      tables.append([
        "rowCount": table.rowCount,
        "columnCount": table.columnCount,
        "cells": cells,
      ])
    }

    // Paragraph/line-level text as an additional fallback view.
    var paragraphs: [String] = []
    for paragraph in document.text.paragraphs {
      let t = paragraph.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
      if !t.isEmpty { paragraphs.append(t) }
    }

    FileHandle.standardError.write(
      "[doc] \(name)  tables=\(tables.count)  cells=\(tables.reduce(0){ $0 + (($1["cells"] as? [Any])?.count ?? 0) })  paras=\(paragraphs.count)\n"
        .data(using: .utf8)!)

    return [
      "image": name,
      "fullText": fullText,
      "tables": tables,
      "paragraphs": paragraphs,
    ]
  } catch {
    return ["image": name, "error": "\(error)", "tables": [], "fullText": ""]
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
