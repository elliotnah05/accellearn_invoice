import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { lessonsText, type Student } from "@/types/student";
import type { TemplateConfig } from "@/app/api/config/route";

// Replicates "sample Fees Receipt(Main).docx" in the invoice's visual style:
// header, date, child/level, parent, then the acknowledgment paragraph.
const S = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 11,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 56,
    color: "#000000",
  },

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
  formTitle: { fontSize: 13, fontFamily: "Times-Bold", textAlign: "right", alignSelf: "flex-end" },

  receiptNoRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  receiptNo: { fontSize: 9, color: "#888888" },

  infoSection: { marginTop: 14 },
  infoRow: { flexDirection: "row", marginBottom: 10 },
  infoLabel: { fontFamily: "Times-Bold", width: 170 },
  infoValue: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: "#000" },
  infoDateRow: { flexDirection: "row", marginBottom: 10, justifyContent: "flex-end" },
  infoDateLabel: { fontFamily: "Times-Bold", marginRight: 6 },
  infoDateValue: { minWidth: 90, borderBottomWidth: 0.5, borderBottomColor: "#000" },

  body: { marginTop: 18, lineHeight: 1.6 },
  bold: { fontFamily: "Times-Bold" },
  thanks: { marginTop: 14 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    borderTopWidth: 0.5,
    borderTopColor: "#AB33DA",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#888888" },
});

function fmtSGD(n: number): string {
  return `$${n.toFixed(2)}`;
}

function todayDMY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Best-effort end-of-term date: the student's own end date if set, else the
 *  end of the matching term in the configured schedule ("… to <date>"). */
export function termEndDate(s: Student, config: TemplateConfig, sheetName: string): string {
  if (s.differentEndDate) return s.differentEndDate;
  const m = sheetName.match(/T(\d)/i);
  if (m) {
    const row = config.schedule.find(
      (r) => r.type === "term" && r.label.replace(/\s+/g, "").toLowerCase() === `term${m[1]}`
    );
    const tail = row?.period.split(/\bto\b/i)[1]?.trim();
    if (tail) return tail;
  }
  return "";
}

interface Props {
  student: Student;
  logoBase64: string;
  config: TemplateConfig;
  receiptNo: string;
  term: string;        // e.g. "AY 26 T3"
  endDate: string;     // e.g. "2/8/26"
  paymentDate: string; // e.g. "12/7/26" — from the sheet's Date of Receipt
}

export function ReceiptPDF({ student: s, logoBase64, config, receiptNo, term, endDate, paymentDate }: Props) {
  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.headerRow}>
          <Image src={logoBase64} style={S.logo} />
          <View style={S.headerTextBlock}>
            <Text style={S.companyName}>ACCELLEARN</Text>
          </View>
          <Text style={S.formTitle}>RECEIPT FOR FEES PAYMENT</Text>
        </View>

        <View style={S.receiptNoRow}>
          <Text style={S.receiptNo}>Receipt No: {receiptNo}</Text>
        </View>

        {/* ── Date + info ── */}
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

        {/* ── Acknowledgment ── */}
        <View style={S.body}>
          <Text>
            {"This is to acknowledge that we have received a payment of "}
            <Text style={S.bold}>{fmtSGD(s.totalFee)}</Text>
            {paymentDate ? <Text>{" on "}<Text style={S.bold}>{paymentDate}</Text></Text> : null}
            {" for the Term "}
            <Text style={S.bold}>{term}</Text>
            {" for "}
            <Text style={S.bold}>{lessonsText(s)}</Text>
            {" lessons"}
            {endDate ? <Text>{" ending on "}<Text style={S.bold}>{endDate}</Text></Text> : null}
            {"."}
          </Text>
          <Text style={S.thanks}>Thank you.</Text>
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
