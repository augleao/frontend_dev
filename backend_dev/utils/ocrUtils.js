const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

/**
 * Extrai uma imagem (PNG) de uma página do PDF usando pdfjs-dist
 * @param {string} pdfPath Caminho do PDF
 * @param {number} pageNum Número da página (1-based)
 * @param {string} outPath Caminho do arquivo PNG de saída
 * @returns {Promise<string>} Caminho do PNG gerado
 */
async function renderPdfPageToPng(pdfPath, pageNum, outPath) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvasFactory = new pdfjsLib.NodeCanvasFactory();
  const canvasAndCtx = canvasFactory.create(viewport.width, viewport.height);
  const renderContext = {
    canvasContext: canvasAndCtx.context,
    viewport,
    canvasFactory,
  };
  await page.render(renderContext).promise;
  const buffer = canvasAndCtx.canvas.toBuffer();
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

/**
 * Executa OCR em uma imagem usando Tesseract.js
 * @param {string} imagePath Caminho da imagem
 * @param {object} [opts] Opções do Tesseract
 * @returns {Promise<string>} Texto extraído
 */
async function ocrImage(imagePath, opts = {}) {
  const { data: { text } } = await Tesseract.recognize(imagePath, 'por', opts);
  return text;
}

module.exports = {
  renderPdfPageToPng,
  ocrImage,
};
