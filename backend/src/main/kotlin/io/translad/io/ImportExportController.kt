package io.translad.io

import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/projects/{projectId}")
class ImportExportController(private val service: ImportExportService) {

    /** Import a JSON object of key→value translations for one language. */
    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','TRANSLATOR')")
    fun import(
        @PathVariable projectId: UUID,
        @RequestParam lang: String,
        @RequestBody entries: Map<String, String>,
    ): ImportResult = service.import(projectId, lang, entries)

    /** Export one language as a downloadable JSON or CSV file. */
    @GetMapping("/export")
    fun export(
        @PathVariable projectId: UUID,
        @RequestParam lang: String,
        @RequestParam(defaultValue = "json") format: String,
    ): ResponseEntity<ByteArray> {
        val data = service.export(projectId, lang)
        return if (format.equals("csv", ignoreCase = true)) {
            val csv = buildString {
                append("key,value\n")
                for ((k, v) in data) append("${csvCell(k)},${csvCell(v)}\n")
            }
            file(csv.toByteArray(), "translations-$lang.csv", "text/csv")
        } else {
            val json = buildString {
                append("{\n")
                val entries = data.entries.toList()
                entries.forEachIndexed { i, (k, v) ->
                    append("  ${jsonStr(k)}: ${jsonStr(v)}")
                    append(if (i < entries.size - 1) ",\n" else "\n")
                }
                append("}\n")
            }
            file(json.toByteArray(), "translations-$lang.json", "application/json")
        }
    }

    private fun file(bytes: ByteArray, name: String, type: String): ResponseEntity<ByteArray> =
        ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"$name\"")
            .contentType(MediaType.parseMediaType(type))
            .body(bytes)

    private fun csvCell(s: String): String =
        if (s.contains(',') || s.contains('"') || s.contains('\n')) "\"${s.replace("\"", "\"\"")}\"" else s

    private fun jsonStr(s: String): String =
        "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""
}
