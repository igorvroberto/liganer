import type { BlankInput, PvcOption } from "./types";
import { isSlitterItem, pvcLabel } from "./types";
import { fmtThickness } from "./format";

/** Chave de material: só itens iguais podem compartilhar o mesmo programa de corte. */
export function materialSpecKey(
  blank: Pick<BlankInput, "tipo" | "acabamento" | "pvc" | "thickness">,
): string {
  const tipo = String(blank.tipo ?? "")
    .trim()
    .toUpperCase();
  const acabamento = String(blank.acabamento ?? "")
    .trim()
    .toUpperCase();
  const pvc = blank.pvc ?? "";
  const esp =
    blank.thickness != null && Number.isFinite(blank.thickness) && blank.thickness > 0
      ? String(blank.thickness)
      : "";
  return `${tipo}|${acabamento}|${pvc}|${esp}`;
}

export type MaterialGroup = {
  key: string;
  blanks: BlankInput[];
  /** Índices no array original de blanks ativos. */
  indices: number[];
};

export function groupBlanksByMaterialSpec(blanks: BlankInput[]): MaterialGroup[] {
  const map = new Map<string, MaterialGroup>();
  blanks.forEach((blank, index) => {
    const key = materialSpecKey(blank);
    let group = map.get(key);
    if (!group) {
      group = { key, blanks: [], indices: [] };
      map.set(key, group);
    }
    group.blanks.push(blank);
    group.indices.push(index);
  });
  return [...map.values()];
}

export type BlankSpecCitation = {
  tipo: string;
  acabamento: string;
  pvc: string;
  espessura: string;
  largura: string;
  comprimento: string;
};

/** Campos citados nos programas de corte. */
export function blankSpecCitation(blank: BlankInput): BlankSpecCitation {
  return {
    tipo: blank.tipo?.trim() ? blank.tipo.trim() : "—",
    acabamento: blank.acabamento?.trim() ? blank.acabamento.trim() : "—",
    pvc: blank.pvc ? pvcLabel(blank.pvc as PvcOption) : "—",
    espessura: blank.thickness && blank.thickness > 0 ? fmtThickness(blank.thickness) : "—",
    largura: blank.width > 0 ? String(Math.round(blank.width)) : "—",
    comprimento: blank.length > 0 ? String(Math.round(blank.length)) : "—",
  };
}

export function blankSpecCitationLine(blank: BlankInput): string {
  const c = blankSpecCitation(blank);
  const size = isSlitterItem(blank) ? `${c.largura} mm` : `${c.largura}×${c.comprimento} mm`;
  return [
    `Tipo ${c.tipo}`,
    `Acab. ${c.acabamento}`,
    `PVC ${c.pvc}`,
    `Esp. ${c.espessura}`,
    size,
  ].join(" · ");
}
