import type { jsPDF } from "jspdf";
import { ROBOTO_LATIN_BOLD, ROBOTO_LATIN_REGULAR } from "./fonts/robotoLatin";

export const PDF_FONT_NAME = "RobotoLatin";

export function registerPdfFonts(doc: jsPDF): string {
  doc.addFileToVFS("RobotoLatin-Regular.ttf", ROBOTO_LATIN_REGULAR);
  doc.addFont("RobotoLatin-Regular.ttf", PDF_FONT_NAME, "normal");
  doc.addFileToVFS("RobotoLatin-Bold.ttf", ROBOTO_LATIN_BOLD);
  doc.addFont("RobotoLatin-Bold.ttf", PDF_FONT_NAME, "bold");
  doc.setFont(PDF_FONT_NAME, "normal");
  return PDF_FONT_NAME;
}
