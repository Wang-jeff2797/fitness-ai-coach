/**
 * PWA 图标生成脚本
 * 使用前需要安装 sharp: npm install sharp --save-dev
 * 运行: node scripts/generate-icons.js
 *
 * 如果你没有 sharp，可以直接用在线工具生成 PNG 图标放在 public/icons/ 目录下
 */
const fs = require("fs");
const path = require("path");
async function generateIcons() {
  try {
    const sharp = require("sharp");
    const sizes = [
      { size: 192, name: "icon-192.png" },
      { size: 512, name: "icon-512.png" },
    ];
    // 使用 SVG 作为源
    const svgBuffer = fs.readFileSync(
      path.join(__dirname, "../public/icons/icon.svg")
    );
    for (const { size, name } of sizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(__dirname, `../public/icons/${name}`));
      console.log(`Generated ${name} (${size}x${size})`);
    }
    console.log("All icons generated!");
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      console.log(
        "sharp not installed. Install it with: npm install sharp --save-dev"
      );
      console.log(
        "Or manually convert the SVG to PNG using online tools."
      );
    } else {
      console.error("Error generating icons:", err);
    }
  }
}
generateIcons();
