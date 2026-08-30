# vibeQwenGlasses 默认不开启混淆（isMinifyEnabled=false）。
# 保留此文件以便 release 构建引用，并避免删除必要组件。
-keep class com.vibeqwen.glasses.** { *; }
-keep class androidx.core.content.FileProvider { *; }
-dontwarn org.json.**
