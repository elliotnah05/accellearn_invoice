import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Student } from "@/types/student";
import type { TemplateConfig } from "@/app/api/config/route";

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    paddingTop: 22,
    paddingBottom: 26,
    paddingHorizontal: 48,
    color: "#000000",
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: "#AB33DA",
    paddingBottom: 6,
  },
  logo: { width: 44, height: 44 },
  headerTextBlock: { flex: 1, marginLeft: 12 },
  companyName: { fontSize: 16, fontFamily: "Times-Bold", color: "#AB33DA", letterSpacing: 1 },
  formTitle: { fontSize: 14, fontFamily: "Times-Bold", textAlign: "right", alignSelf: "flex-end" },

  // Info fields
  infoSection: { marginTop: 8, marginBottom: 6 },
  infoRow: { flexDirection: "row", marginBottom: 4 },
  infoLabel: { fontFamily: "Times-Bold", width: 160 },
  infoValue: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: "#000" },
  infoDateRow: { flexDirection: "row", marginBottom: 4, justifyContent: "flex-end" },
  infoDateLabel: { fontFamily: "Times-Bold", marginRight: 6 },
  infoDateValue: { minWidth: 80, borderBottomWidth: 0.5, borderBottomColor: "#000" },

  // T&C
  tcTitle: { fontFamily: "Times-Bold", marginTop: 8, marginBottom: 4 },
  tcClause: { marginBottom: 4, lineHeight: 1.15 },
  tcBold: { fontFamily: "Times-Bold" },
  feeRow: { marginLeft: 16, marginBottom: 1, lineHeight: 1.15 },

  // ── Schedule table ──────────────────────────────────────────────────────────
  scheduleTable: {
    marginLeft: 16,
    marginTop: 3,
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: "#000",
    width: 220,
  },
  scheduleHeader: {
    flexDirection: "row",
    backgroundColor: "#f0e6f9",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
  },
  scheduleRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
  },
  scheduleRowLast: { flexDirection: "row" },
  scheduleBreakRow: {
    flexDirection: "row",
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
  },
  schColLabel:  { width: 55, paddingHorizontal: 5, paddingVertical: 2, borderRightWidth: 0.5, borderRightColor: "#000" },
  schColPeriod: { flex: 1,   paddingHorizontal: 5, paddingVertical: 2 },
  schHeaderText:{ fontFamily: "Times-Bold", fontSize: 8 },
  schText:      { fontSize: 9 },
  schBreakText: { fontSize: 9, color: "#888888" },

  // ── Items table ─────────────────────────────────────────────────────────────
  table: { marginTop: 4, marginBottom: 4, borderWidth: 0.5, borderColor: "#000" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0e6f9",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    minHeight: 13,
  },
  tableRowLast: { flexDirection: "row", minHeight: 13 },
  tableRowGrand: {
    flexDirection: "row",
    backgroundColor: "#f0e6f9",
    borderTopWidth: 1,
    borderTopColor: "#000",
    minHeight: 17,
  },
  colNo:    { width: 28, borderRightWidth: 0.5, borderRightColor: "#000", paddingHorizontal: 4, paddingVertical: 2 },
  colItem:  { flex: 1,   borderRightWidth: 0.5, borderRightColor: "#000", paddingHorizontal: 4, paddingVertical: 2 },
  colQty:   { width: 60, borderRightWidth: 0.5, borderRightColor: "#000", paddingHorizontal: 4, paddingVertical: 2, textAlign: "center" },
  colTotal: { width: 70, paddingHorizontal: 4, paddingVertical: 2, textAlign: "right" },
  thText:   { fontFamily: "Times-Bold", fontSize: 9 },
  grandLabel: { flex: 1, fontFamily: "Times-Bold", paddingHorizontal: 4, paddingVertical: 3, textAlign: "right" },
  grandValue: { width: 70, fontFamily: "Times-Bold", paddingHorizontal: 4, paddingVertical: 3, textAlign: "right" },

  // Payment
  paymentSection: { marginTop: 6, lineHeight: 1.15 },
  paymentBold: { fontFamily: "Times-Bold" },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: "#AB33DA",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#888888" },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSGD(n: number): string {
  const abs = Math.abs(n);
  const str = `$${abs.toFixed(2)}`;
  // Explicit minus sign for negatives (e.g. a −$40 discount prints "-$40.00"),
  // so a reduced Adjustment reads clearly on the invoice rather than as
  // accounting-style brackets.
  return n < 0 ? `-${str}` : str;
}

function todayDMY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  student: Student;
  logoBase64: string;
  config: TemplateConfig;
}

export function InvoicePDF({ student: s, logoBase64, config }: Props) {
  // One invoice per child: a block of line items per subject.
  // The Material Fee prints as a bare amount (negative = discount). Its NOTES
  // column is the admin's internal record and must never reach the parent, so
  // nothing is printed when the amount is zero — a $0 material fee has nothing
  // to say without its note.
  const rows: { item: string; qty: string; total: string }[] = [];
  for (const line of s.subjects) {
    const tag = line.subject ? ` — ${line.subject}` : "";
    rows.push({ item: `Lesson Fee${tag}`, qty: String(line.lessons), total: fmtSGD(line.lessonFee) });
    if (line.adjustment !== 0) {
      rows.push({ item: `Material Fee${tag}`, qty: "-", total: fmtSGD(line.adjustment) });
    }
  }
  const items = rows.map((r, i) => ({ no: `${i + 1}.`, ...r }));
  while (items.length < 4) {
    items.push({ no: `${items.length + 1}.`, item: "", qty: "", total: "" });
  }

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.headerRow}>
          <Image src={logoBase64} style={S.logo} />
          <View style={S.headerTextBlock}>
            <Text style={S.companyName}>ACCELLEARN</Text>
          </View>
          <Text style={S.formTitle}>FEES PAYABLE FORM</Text>
        </View>

        {/* ── Date + Student info ── */}
        <View style={S.infoSection}>
          <View style={S.infoDateRow}>
            <Text style={S.infoDateLabel}>Date:</Text>
            <Text style={S.infoDateValue}>{todayDMY()}</Text>
          </View>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>Name of Child and Level:</Text>
            <Text style={S.infoValue}>{s.studentName}   ({s.level})</Text>
          </View>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>Name of Parent:</Text>
            <Text style={S.infoValue}>{s.parentName}</Text>
          </View>
        </View>

        {/* ── Terms & Conditions ── */}
        <Text style={S.tcTitle}>Terms and Conditions:</Text>

        <Text style={S.tcClause}>
          <Text style={S.tcBold}>1)</Text>
          {"  "}{config.clause1}
        </Text>

        <Text style={S.tcClause}>
          <Text style={S.tcBold}>2)</Text>
          {"  Our centre will conduct 4 weeks of break every year. Please refer to the schedule below."}
        </Text>

        {/* ── Schedule table ── */}
        <View style={S.scheduleTable}>
          <View style={S.scheduleHeader}>
            <Text style={[S.schColLabel,  S.schHeaderText]}>Period</Text>
            <Text style={[S.schColPeriod, S.schHeaderText]}>Dates</Text>
          </View>
          {config.schedule.map((row, i) => {
            const isLast   = i === config.schedule.length - 1;
            const isBreak  = row.type === "break";
            const rowStyle = isLast ? S.scheduleRowLast : isBreak ? S.scheduleBreakRow : S.scheduleRow;
            const txtStyle = isBreak ? S.schBreakText : S.schText;
            return (
              <View key={i} style={rowStyle}>
                <Text style={[S.schColLabel,  txtStyle]}>{row.label}</Text>
                <Text style={[S.schColPeriod, txtStyle]}>{row.period}</Text>
              </View>
            );
          })}
        </View>

        <Text style={S.tcClause}>
          <Text style={S.tcBold}>3)</Text>
          {"  "}{config.feeScheduleIntro}
        </Text>
        {config.feeScheduleLines.map((line, i) => (
          <Text
            key={i}
            style={i === config.feeScheduleLines.length - 1 ? { ...S.feeRow, marginBottom: 4 } : S.feeRow}
          >
            {line}
          </Text>
        ))}

        <Text style={S.tcClause}>
          <Text style={S.tcBold}>4)</Text>
          {"  "}{config.clause4}
        </Text>

        <Text style={S.tcClause}>
          <Text style={S.tcBold}>5)</Text>
          {"  The payable fees are as follows:"}
        </Text>

        {/* ── Items Table ── */}
        <View style={S.table} wrap={false}>
          <View style={S.tableHeader}>
            <Text style={[S.colNo,    S.thText]}>No</Text>
            <Text style={[S.colItem,  S.thText]}>Item</Text>
            <Text style={[S.colQty,   S.thText, { textAlign: "center" }]}>Quantity</Text>
            <Text style={[S.colTotal, S.thText, { textAlign: "right"  }]}>Total</Text>
          </View>
          {items.map((row, i) => (
            <View key={i} style={i < items.length - 1 ? S.tableRow : S.tableRowLast}>
              <Text style={S.colNo}>{row.no}</Text>
              <Text style={S.colItem}>{row.item}</Text>
              <Text style={S.colQty}>{row.qty}</Text>
              <Text style={S.colTotal}>{row.total}</Text>
            </View>
          ))}
          <View style={S.tableRowGrand}>
            <Text style={S.colNo}></Text>
            <Text style={S.grandLabel}>Grand Total:</Text>
            <Text style={S.grandValue}>{fmtSGD(s.totalFee)}</Text>
          </View>
        </View>

        {/* ── Payment ── */}
        <View style={S.paymentSection} wrap={false}>
          <Text>
            <Text style={S.paymentBold}>6)  Modes of Payment: </Text>
            {"Paynow to "}
            <Text style={S.paymentBold}>{config.payNowUEN}</Text>
          </Text>
          <Text>
            <Text style={S.paymentBold}>Name of Company: </Text>
            {config.companyName}
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>AccelLearn · {config.companyName} · accellearn.sg</Text>
          <Text style={S.footerText}>CONFIDENTIAL — For recipient only</Text>
        </View>

      </Page>
    </Document>
  );
}
