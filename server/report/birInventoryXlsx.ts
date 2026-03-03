import ExcelJS from "exceljs";
import type { InventoryList } from "./types";

const formatAsOfDate = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(parsed);
};

const thinBorder = {
  top: { style: "thin" as const, color: { argb: "FF111827" } },
  left: { style: "thin" as const, color: { argb: "FF111827" } },
  bottom: { style: "thin" as const, color: { argb: "FF111827" } },
  right: { style: "thin" as const, color: { argb: "FF111827" } },
};

/**
 * Generates BIR Annex A inventory list as XLSX buffer.
 * Layout matches official BIR form (11 columns).
 */
export async function generateBirInventoryListXlsx(list: InventoryList): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Annex A", {
    pageSetup: { orientation: "landscape", fitToPage: true },
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 18 },
    { width: 28 },
    { width: 18 },
    { width: 10 },
    { width: 16 },
    { width: 20 },
    { width: 12 },
    { width: 14 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
  ];

  sheet.getRow(1).height = 18;
  sheet.getRow(3).height = 18;
  sheet.getRow(4).height = 18;
  sheet.getRow(5).height = 18;
  sheet.getRow(6).height = 18;

  sheet.getCell("A1").value = "For Retail / Manufacturing Industry";
  sheet.getCell("A1").font = { bold: true, size: 11 };
  sheet.getCell("K1").value = "ANNEX A";
  sheet.getCell("K1").font = { bold: true, size: 11 };
  sheet.getCell("K1").alignment = { horizontal: "right" };

  sheet.mergeCells("A3:K3");
  sheet.getCell("A3").value = "NAME OF COMPANY";
  sheet.getCell("A3").alignment = { horizontal: "center" };
  sheet.getCell("A3").font = { bold: true };

  sheet.mergeCells("A4:K4");
  sheet.getCell("A4").value = list.company.name;
  sheet.getCell("A4").alignment = { horizontal: "center" };
  sheet.getCell("A4").font = { bold: true };

  sheet.mergeCells("A5:K5");
  sheet.getCell("A5").value =
    "MERCHANDISE/ RAW MATERIALS / GOODS IN PROCESS / FINISHED GOODS INVENTORY";
  sheet.getCell("A5").alignment = { horizontal: "center" };
  sheet.getCell("A5").font = { bold: true, size: 11 };

  sheet.mergeCells("A6:K6");
  sheet.getCell("A6").value = `As of ${formatAsOfDate(list.header.inventoryDate)}`;
  sheet.getCell("A6").alignment = { horizontal: "center" };
  sheet.getCell("A6").font = { size: 11 };

  sheet.mergeCells("A8:A9");
  sheet.mergeCells("B8:B9");
  sheet.mergeCells("C8:E8");
  sheet.mergeCells("F8:F9");
  sheet.mergeCells("G8:G9");
  sheet.mergeCells("H8:H9");
  sheet.mergeCells("I8:I9");
  sheet.mergeCells("J8:J9");
  sheet.mergeCells("K8:K9");

  sheet.getCell("A8").value = "PRODUCT / INVENTORY CODE";
  sheet.getCell("B8").value = "ITEM DESCRIPTION";
  sheet.getCell("C8").value = "LOCATION (Note 1)";
  sheet.getCell("F8").value = "INVENTORY VALUATION METHOD (Note 2)";
  sheet.getCell("G8").value = "UNIT PRICE";
  sheet.getCell("H8").value = "QUANTITY IN STOCKS";
  sheet.getCell("I8").value = "UNIT OF MEASUREMENT (in weight or volume)";
  sheet.getCell("J8").value = "TOTAL WEIGHT / VOLUME";
  sheet.getCell("K8").value = "TOTAL COST";

  sheet.getCell("C9").value = "ADDRESS";
  sheet.getCell("D9").value = "CODE";
  sheet.getCell("E9").value = "REMARKS";

  for (const cell of ["A8", "B8", "C8", "F8", "G8", "H8", "I8", "J8", "K8", "C9", "D9", "E9"]) {
    sheet.getCell(cell).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getCell(cell).font = { bold: true, size: 11 };
  }

  const dataStart = 10;
  const totalRows = Math.max(list.items.length, 5);

  for (let i = 0; i < totalRows; i += 1) {
    const rowIndex = dataStart + i;
    const row = sheet.getRow(rowIndex);
    const item = list.items[i];

    row.getCell(1).value = item?.productCode ?? "";
    row.getCell(2).value = item?.description ?? "";
    row.getCell(3).value = item?.locationAddress ?? "";
    row.getCell(4).value = item?.classificationCode ?? "";
    row.getCell(5).value = item?.locationRemarks ?? "";
    row.getCell(6).value = item?.costingMethod ?? "FIFO";
    row.getCell(7).value = item?.unitCost ?? "";
    row.getCell(8).value = item?.quantity ?? "";
    row.getCell(9).value = item?.unit ?? "";
    row.getCell(10).value = item?.totalWeightVolume ?? "";
    row.getCell(11).value = item?.totalCost ?? "";

    row.alignment = { vertical: "top", wrapText: true };
  }

  const totalRow = dataStart + totalRows;
  sheet.mergeCells(`A${totalRow}:J${totalRow}`);
  sheet.getCell(`A${totalRow}`).value = "Total";
  sheet.getCell(`A${totalRow}`).alignment = { horizontal: "right" };
  sheet.getCell(`A${totalRow}`).font = { bold: true };
  sheet.getCell(`K${totalRow}`).value = list.items.reduce(
    (sum, item) => sum + Number(item.totalCost || 0),
    0
  );
  sheet.getCell(`K${totalRow}`).font = { bold: true };

  const tableStart = 8;
  const tableEnd = totalRow;
  for (let rowIndex = tableStart; rowIndex <= tableEnd; rowIndex += 1) {
    for (let col = 1; col <= 11; col += 1) {
      sheet.getRow(rowIndex).getCell(col).border = thinBorder;
    }
  }

  const noteStart = totalRow + 2;
  const note1a =
    "Include all goods whether taxpayer has title thereto or not, provided these goods are actually situated in location/address at the Head Office or Branch or Facilities (with or without sales activity of the taxpayer). Facilities shall include but not limited to place of production, showroom, warehouse, storage place, leased property, etc. Include also goods out on consignment, though not physically present are nonetheless owned by the taxpayer.";
  const note1bLead = "Use the following codes:";
  const note1bRows = [
    { code: "CH", desc: "Goods on consignment held by the taxpayer", remark: "Indicate the name of the consignor in the Remarks column" },
    { code: "P", desc: "Parked goods or goods owned by related parties", remark: "Indicate the name of related party/owner in the Remarks column" },
    { code: "O", desc: "Goods owned by the taxpayer", remark: "" },
    { code: "CO", desc: "Goods out on consignment held in the hands of entity other than taxpayer", remark: "Indicate the name of the entity in the Remarks column" },
  ];
  const note2 =
    "Indicate costing method applied, e.g., Standard Costing, FIFO, Weighted Average, Specific Identification, etc.";

  sheet.getCell(`A${noteStart}`).value = "Note a";
  sheet.getCell(`A${noteStart}`).alignment = { horizontal: "right", vertical: "top" };
  sheet.getCell(`B${noteStart}`).value = "a";
  sheet.getCell(`B${noteStart}`).alignment = { horizontal: "center", vertical: "top" };
  sheet.getCell(`B${noteStart}`).font = { size: 10, bold: true };
  sheet.mergeCells(`C${noteStart}:K${noteStart}`);
  sheet.getCell(`C${noteStart}`).value = note1a;
  sheet.getCell(`C${noteStart}`).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
  sheet.getCell(`C${noteStart}`).font = { size: 10 };
  sheet.getRow(noteStart).height = 48;

  sheet.getCell(`B${noteStart + 1}`).value = "b";
  sheet.getCell(`B${noteStart + 1}`).alignment = { horizontal: "center", vertical: "top" };
  sheet.getCell(`B${noteStart + 1}`).font = { size: 10, bold: true };
  sheet.mergeCells(`C${noteStart + 1}:K${noteStart + 1}`);
  sheet.getCell(`C${noteStart + 1}`).value = note1bLead;
  sheet.getCell(`C${noteStart + 1}`).alignment = { horizontal: "left", vertical: "top" };
  sheet.getCell(`C${noteStart + 1}`).font = { size: 10 };
  sheet.getRow(noteStart + 1).height = 18;

  note1bRows.forEach((row, index) => {
    const rowIndex = noteStart + 2 + index;
    if (row.code === "CH") {
      sheet.getCell(`C${rowIndex}`).value = {
        richText: [{ text: "C" }, { text: "H", font: { vertAlign: "subscript" } }],
      };
    } else if (row.code === "CO") {
      sheet.getCell(`C${rowIndex}`).value = {
        richText: [{ text: "C" }, { text: "O", font: { vertAlign: "subscript" } }],
      };
    } else {
      sheet.getCell(`C${rowIndex}`).value = row.code;
    }
    sheet.getCell(`C${rowIndex}`).alignment = { horizontal: "center", vertical: "top" };
    sheet.getCell(`C${rowIndex}`).font = { size: 10, bold: true };
    sheet.mergeCells(`D${rowIndex}:E${rowIndex}`);
    sheet.getCell(`D${rowIndex}`).value = row.desc;
    sheet.getCell(`D${rowIndex}`).alignment = { horizontal: "left", vertical: "top", wrapText: true };
    sheet.getCell(`D${rowIndex}`).font = { size: 10 };
    sheet.mergeCells(`G${rowIndex}:K${rowIndex}`);
    sheet.getCell(`G${rowIndex}`).value = row.remark;
    sheet.getCell(`G${rowIndex}`).alignment = { horizontal: "left", vertical: "top", wrapText: true };
    sheet.getCell(`G${rowIndex}`).font = { size: 10 };
    sheet.getRow(rowIndex).height = 18;
  });

  const note2Row = noteStart + 2 + note1bRows.length;
  sheet.getCell(`A${note2Row}`).value = "Note 2";
  sheet.getCell(`A${note2Row}`).alignment = { horizontal: "right", vertical: "top" };
  sheet.getCell(`A${note2Row}`).font = { size: 10, bold: true };
  sheet.mergeCells(`C${note2Row}:K${note2Row}`);
  sheet.getCell(`C${note2Row}`).value = note2;
  sheet.getCell(`C${note2Row}`).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
  sheet.getCell(`C${note2Row}`).font = { size: 10 };
  sheet.getRow(note2Row).height = 20;

  const sigStart = note2Row + 2;
  sheet.mergeCells(`B${sigStart}:K${sigStart}`);
  sheet.getCell(`B${sigStart}`).value =
    "We declare, under the penalties of perjury, that this schedule has been made in good faith, verified by us, and to the best of our knowledge and belief, is true and correct pursuant to the provisions of the National Internal Revenue Code, as amended, and the regulations issued under authority thereof.";
  sheet.getCell(`B${sigStart}`).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
  sheet.getCell(`B${sigStart}`).font = { size: 11 };
  sheet.getRow(sigStart).height = 36;

  const sigLineRow = sigStart + 2;
  sheet.mergeCells(`F${sigLineRow}:J${sigLineRow}`);
  sheet.getCell(`F${sigLineRow}`).border = {
    bottom: { style: "thin", color: { argb: "FF111827" } },
  };

  sheet.mergeCells(`F${sigLineRow + 1}:J${sigLineRow + 1}`);
  sheet.getCell(`F${sigLineRow + 1}`).value = "Name and Signature of Authorized Representative";
  sheet.getCell(`F${sigLineRow + 1}`).alignment = { horizontal: "center" };
  sheet.getCell(`F${sigLineRow + 1}`).font = { size: 11 };

  sheet.mergeCells(`F${sigLineRow + 2}:J${sigLineRow + 2}`);
  sheet.getCell(`F${sigLineRow + 2}`).value = list.company.tin
    ? `TIN: ${list.company.tin}`
    : "TIN: _________________________ (to be filled manually)";
  sheet.getCell(`F${sigLineRow + 2}`).alignment = { horizontal: "center" };
  sheet.getCell(`F${sigLineRow + 2}`).font = { size: 11 };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
