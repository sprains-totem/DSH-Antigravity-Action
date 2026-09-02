// vibeQwenGlasses 工程设置
pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Shizuku 依赖仓库（dev.rikka.shizuku:api/provider）
        maven("https://maven.rikka.app/")
    }
}

rootProject.name = "vibeQwenGlasses"
include(":app")