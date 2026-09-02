# 保持默认；当前未启用混淆（isMinifyEnabled=false）。预留规则模板。
# 若后续开启 R8：
# - kotlinx.serialization 需要序列化器保留规则
# -keepattributes *Annotation*, InnerClasses
# -dontnote kotlinx.serialization.**
# -keepclassmembers class **$$serializer { *; }
# -keepclasseswithmembers class * {
#     kotlinx.serialization.KSerializer serializer(...);
# }