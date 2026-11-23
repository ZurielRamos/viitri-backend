import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import sharp from 'sharp';

/** Archivo tal como llega de multer. */
export interface UploadedMenuFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/** Lo que el modelo recibe: fotos, PDF (los lee él mismo) o texto ya extraído. */
export type MenuPart =
  | { type: 'image'; image: Buffer; mediaType: 'image/jpeg' }
  | {
      type: 'file';
      data: Buffer;
      mediaType: 'application/pdf';
      filename: string;
    }
  | { type: 'text'; text: string };

export const MAX_MENU_FILES = 10;
/** Por archivo: una foto de celular sin comprimir o un PDF de varias páginas. */
export const MAX_MENU_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
/** Texto que se manda al modelo, sumando todo: una carta grande cabe de sobra. */
const MAX_TEXT_CHARS = 60_000;
/** Lado más largo de las fotos: suficiente para leer letra a mano sin pagar de más. */
const IMAGE_MAX_SIDE = 2048;

const IMAGE = /^image\/(jpeg|png|webp|heic|heif|gif|avif|tiff)$/;
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function extension(name: string): string {
  return name.toLowerCase().split('.').pop() ?? '';
}

/**
 * Convierte lo que subió el dueño en partes para el modelo. Acepta fotos
 * (también de una carta escrita a mano), PDF, Word, Excel, CSV y texto.
 * Los formatos que no se pueden leer se rechazan con un mensaje claro.
 */
export async function toMenuParts(
  files: UploadedMenuFile[],
  pastedText?: string,
): Promise<MenuPart[]> {
  if (files.length > MAX_MENU_FILES) {
    throw new BadRequestException(
      `Sube hasta ${MAX_MENU_FILES} archivos a la vez.`,
    );
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    throw new BadRequestException(
      'Los archivos pesan demasiado juntos. Sube menos a la vez.',
    );
  }
  const parts: MenuPart[] = [];
  let textBudget = MAX_TEXT_CHARS;
  const addText = (label: string, text: string) => {
    const clean = text.split(String.fromCharCode(0)).join('').trim();
    if (!clean || textBudget <= 0) return;
    const slice = clean.slice(0, textBudget);
    textBudget -= slice.length;
    parts.push({ type: 'text', text: `${label}:\n${slice}` });
  };

  for (const file of files) {
    const ext = extension(file.originalname);
    try {
      if (
        IMAGE.test(file.mimetype) ||
        ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)
      ) {
        // Endereza la foto según el celular (EXIF) y la achica.
        const image = await sharp(file.buffer)
          .rotate()
          .resize(IMAGE_MAX_SIDE, IMAGE_MAX_SIDE, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 82 })
          .toBuffer();
        parts.push({ type: 'image', image, mediaType: 'image/jpeg' });
      } else if (file.mimetype === 'application/pdf' || ext === 'pdf') {
        // El modelo lee el PDF directamente, también si es escaneado.
        parts.push({
          type: 'file',
          data: file.buffer,
          mediaType: 'application/pdf',
          filename: file.originalname || 'carta.pdf',
        });
      } else if (file.mimetype === DOCX || ext === 'docx') {
        const { value } = await mammoth.extractRawText({ buffer: file.buffer });
        addText(`Documento de Word "${file.originalname}"`, value);
      } else if (file.mimetype === XLSX || ext === 'xlsx') {
        addText(
          `Hoja de cálculo "${file.originalname}"`,
          await spreadsheetText(file.buffer),
        );
      } else if (
        file.mimetype.startsWith('text/') ||
        ['csv', 'txt', 'tsv', 'md'].includes(ext)
      ) {
        addText(`Archivo "${file.originalname}"`, file.buffer.toString('utf8'));
      } else if (ext === 'doc' || ext === 'xls') {
        throw new BadRequestException(
          `"${file.originalname}" es de una versión vieja de Office. Guárdalo como .docx o .xlsx, o súbelo en PDF.`,
        );
      } else {
        throw new BadRequestException(
          `No podemos leer "${file.originalname}". Sube fotos, PDF, Word, Excel o CSV.`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `No pudimos abrir "${file.originalname}". Revisa que no esté dañado o con clave.`,
      );
    }
  }
  if (pastedText) addText('Texto que pegó el dueño', pastedText);
  if (!parts.length) {
    throw new BadRequestException(
      'Sube una foto o un archivo de tu carta, o pega el texto.',
    );
  }
  return parts;
}

/** Cada hoja como líneas separadas por " | ", que el modelo entiende como tabla. */
async function spreadsheetText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets: string[] = [];
  workbook.eachSheet((sheet) => {
    const rows: string[] = [];
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[])
        .slice(1)
        .map((value) => cellText(value).trim());
      if (cells.some(Boolean)) rows.push(cells.join(' | '));
    });
    if (rows.length) sheets.push(`Hoja "${sheet.name}":\n${rows.join('\n')}`);
  });
  return sheets.join('\n\n');
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as {
      text?: unknown;
      result?: unknown;
      richText?: { text: string }[];
    };
    if (v.richText) return v.richText.map((r) => r.text).join('');
    // Hipervínculos y fórmulas: su texto o su resultado.
    if (v.text !== undefined) return cellText(v.text);
    if (v.result !== undefined) return cellText(v.result);
    return '';
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}
