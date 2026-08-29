package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import android.content.Context
import android.text.Html
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.GZIPInputStream
import org.json.JSONObject

internal data class LiturgyArchiveCategory(
    val id: String,
    val name: String,
    val total: Int,
    val files: List<String>,
)

internal data class LiturgyArchiveDocument(
    val id: String,
    val path: String,
    val title: String,
    val text: String,
    val html: String,
) {
    fun readableText(): String {
        if (text.isNotBlank()) return normalizeText(text)
        if (html.isBlank()) return ""
        val parsed = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY)
        } else {
            @Suppress("DEPRECATION")
            Html.fromHtml(html)
        }
        return normalizeText(parsed.toString())
    }

    private fun normalizeText(value: String): String = value
        .replace('\u00a0', ' ')
        .replace(Regex("[ \\t]+\\n"), "\n")
        .replace(Regex("\\n{3,}"), "\n\n")
        .trim()
}

/**
 * Lê o mesmo acervo iLiturgia compactado usado pela Beta 18, sem WebView.
 *
 * A Beta 18 compartilha gerais.html.json.gz entre três categorias lógicas:
 * - 469 documentos em evangelho/* pertencem a Evangelhos/Lectio Divina;
 * - IGLH.htm e bienal.htm completam o Ofício (3.750 + 2 = 3.752);
 * - os quatro documentos raiz restantes pertencem a Documentos gerais.
 *
 * Os pacotes GZIP ficam dentro do APK com sufixo .bin para impedir que o merger
 * de assets do Android tente descompactá-los durante o build. A leitura nativa
 * continua sendo feita sob demanda com GZIPInputStream.
 */
internal class OfflineLiturgyArchiveRepository(private val context: Context) {
    private val categoryCache = ConcurrentHashMap<String, List<LiturgyArchiveDocument>>()
    private val packageCache = ConcurrentHashMap<String, List<LiturgyArchiveDocument>>()

    val categories: List<LiturgyArchiveCategory> by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
        val root = context.assets.open("iliturgia/manifest.json")
            .bufferedReader(Charsets.UTF_8)
            .use { JSONObject(it.readText()) }
        val array = root.optJSONArray("categorias")
        buildList {
            if (array != null) repeat(array.length()) { index ->
                val item = array.optJSONObject(index) ?: return@repeat
                val filesArray = item.optJSONArray("arquivos")
                val files = buildList {
                    if (filesArray != null) repeat(filesArray.length()) { fileIndex ->
                        val file = filesArray.optString(fileIndex)
                        if (file.isNotBlank()) add(file)
                    }
                }
                add(
                    LiturgyArchiveCategory(
                        id = item.optString("id"),
                        name = item.optString("nome"),
                        total = item.optInt("total"),
                        files = files,
                    ),
                )
            }
        }
    }

    fun documents(categoryId: String): List<LiturgyArchiveDocument> = categoryCache.getOrPut(categoryId) {
        val category = categories.firstOrNull { it.id == categoryId } ?: return@getOrPut emptyList()
        when (categoryId) {
            "evangelho" -> sharedGeneralDocuments().filter { it.normalizedPath().startsWith("evangelho/") }
            "geral" -> sharedGeneralDocuments().filter { document ->
                val path = document.normalizedPath()
                !path.startsWith("evangelho/") && path.substringAfterLast('/') !in OFFICE_GENERAL_FILES
            }
            "oficio" -> {
                val office = category.files.flatMap(::readPackage)
                val sharedOffice = sharedGeneralDocuments().filter { document ->
                    document.normalizedPath().substringAfterLast('/') in OFFICE_GENERAL_FILES
                }
                office + sharedOffice
            }
            else -> category.files.flatMap(::readPackage)
        }
    }

    fun clearCategory(categoryId: String) {
        categoryCache.remove(categoryId)
    }

    private fun sharedGeneralDocuments(): List<LiturgyArchiveDocument> = readPackage(GENERAL_PACKAGE)

    private fun readPackage(fileName: String): List<LiturgyArchiveDocument> = packageCache.getOrPut(fileName) {
        val assetName = if (fileName.endsWith(".gz")) "$fileName.bin" else fileName
        val root = context.assets.open("iliturgia/$assetName").use { raw ->
            GZIPInputStream(raw).bufferedReader(Charsets.UTF_8).use { reader ->
                JSONObject(reader.readText())
            }
        }
        val array = root.optJSONArray("documents") ?: return@getOrPut emptyList()
        buildList(array.length()) {
            repeat(array.length()) { index ->
                val item = array.optJSONObject(index) ?: return@repeat
                add(
                    LiturgyArchiveDocument(
                        id = item.optString("id"),
                        path = item.optString("path"),
                        title = item.optString("title").ifBlank { item.optString("path") },
                        text = item.optString("text"),
                        html = item.optString("html"),
                    ),
                )
            }
        }
    }

    private fun LiturgyArchiveDocument.normalizedPath(): String = path
        .replace('\\', '/')
        .trimStart('/')
        .lowercase()

    private companion object {
        const val GENERAL_PACKAGE = "gerais.html.json.gz"
        val OFFICE_GENERAL_FILES = setOf("iglh.htm", "bienal.htm")
    }
}
