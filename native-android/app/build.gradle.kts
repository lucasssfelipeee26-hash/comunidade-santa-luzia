plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val generatedOfflineAssetsDir = layout.buildDirectory.dir("generated/offlineAssets").get().asFile
val prepareOfflineAssets = tasks.register<Sync>("prepareOfflineAssets") {
    from(rootProject.file("../public/offline/liturgia-completa")) {
        include("2026-*.json")
        into("liturgia-completa")
    }
    from(rootProject.file("../public/offline/iliturgia")) {
        // O Centro Liturgico da Beta usa estes mesmos pacotes JSON compactados.
        // O merger de assets do Android tenta descompactar automaticamente arquivos
        // terminados em .gz. Renomeamos apenas dentro do APK para preservar os bytes
        // compactados e fazemos a leitura nativa com GZIPInputStream em runtime.
        include("manifest.json", "*.html.json.gz")
        rename { fileName -> if (fileName.endsWith(".gz")) "$fileName.bin" else fileName }
        into("iliturgia")
    }
    into(generatedOfflineAssetsDir)
}

android {
    namespace = "br.com.comunidadesantaluzia.nativeapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "br.com.comunidadesantaluzia.nativebeta"
        minSdk = 24
        targetSdk = 36
        versionCode = 30001
        versionName = "3.0.0-native-alpha.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
        buildConfigField(
            "String",
            "SYNC_BASE_URL",
            "\"https://comunidade-santa-luzia-production.up.railway.app\"",
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(generatedOfflineAssetsDir)
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += setOf(
            "/META-INF/{AL2.0,LGPL2.1}",
            "META-INF/DEPENDENCIES",
        )
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Assets") }.configureEach {
    dependsOn(prepareOfflineAssets)
}

composeCompiler {
    reportsDestination = layout.buildDirectory.dir("compose_compiler")
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.06.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    // Linha estável compatível com compileSdk 36 no ambiente de CI atual.
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.navigation:navigation-compose:2.9.8")
    implementation("androidx.datastore:datastore-preferences:1.2.1")
    implementation("androidx.work:work-runtime-ktx:2.11.2")
    implementation("androidx.sqlite:sqlite-framework:2.7.0")
    implementation("androidx.metrics:metrics-performance:1.0.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    testImplementation("androidx.test:core:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
