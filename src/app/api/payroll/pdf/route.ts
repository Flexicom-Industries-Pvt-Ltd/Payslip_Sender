import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getAuthSession } from '@/lib/auth';
import {
  getAccessibleTemplatesForWorkspace,
  getPayslipTemplateById,
  getWorkspaceById,
} from '@/lib/db-store';
import { generateFormattedPayslipPdf } from '@/lib/payslip-pdf-generator';
import {
  parsePayslipTemplateConfig,
  type PayslipPresetStyle,
  type PayslipTemplateConfig,
} from '@/lib/payslip-template-presets';
import { parseWorkspacePermissions } from '@/lib/workspace-permissions';
import type { PayrollSlipEntry } from '@/lib/payslip-calculator';

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const mode: 'single' | 'zip' | 'base64_batch' = body.mode || 'single';
    const workspaceId =
      session.role === 'SUPER_ADMIN' && body.workspaceId
        ? body.workspaceId
        : session.workspaceId;

    const ws = workspaceId ? await getWorkspaceById(workspaceId) : null;
    const perms = parseWorkspacePermissions(ws?.permissionsJson);

    if (
      mode !== 'base64_batch' &&
      body.download === true &&
      session.role !== 'SUPER_ADMIN' &&
      !perms.allowBulkDownload
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Downloading PDFs/ZIPs is disabled by Top Group Admin (Email-Only mode).',
        },
        { status: 403 }
      );
    }

    let presetStyle: PayslipPresetStyle = body.presetStyle || 'CLASSIC_CORPORATE';
    let config: PayslipTemplateConfig = parsePayslipTemplateConfig(body.templateConfig);

    if (body.templateId && !body.templateConfig) {
      const tpl = await getPayslipTemplateById(body.templateId);
      if (tpl) {
        // Verify company is allowed to use this template
        if (workspaceId && session.role !== 'SUPER_ADMIN') {
          const allowed = await getAccessibleTemplatesForWorkspace(workspaceId);
          if (!allowed.some((a) => a.id === tpl.id)) {
            return NextResponse.json(
              { success: false, error: 'Selected template is not permitted for this company.' },
              { status: 403 }
            );
          }
        }
        presetStyle = tpl.presetStyle;
        config = tpl.config;
      }
    }

    const month = body.month || 'October';
    const year = body.year || String(new Date().getFullYear());
    const companyName = body.companyName || ws?.name || 'Top Group';
    const legalName = body.legalName ?? ws?.legalName ?? companyName;
    const tagline = body.tagline ?? ws?.tagline ?? null;
    const primaryColor = body.primaryColor || ws?.primaryColor || '#0F172A';
    const logoUrl = ws?.logoUrl || null;
    const iconUrl = ws?.iconUrl || null;

    if (mode === 'zip') {
      if (session.role !== 'SUPER_ADMIN' && !perms.allowBulkDownload) {
        return NextResponse.json(
          { success: false, error: 'Bulk ZIP download is disabled by Top Group Admin.' },
          { status: 403 }
        );
      }
      const entries: PayrollSlipEntry[] = Array.isArray(body.entries) ? body.entries : [];
      if (entries.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No payroll rows provided to package.' },
          { status: 400 }
        );
      }

      const zip = new JSZip();
      for (const entry of entries) {
        const pdfBuf = await generateFormattedPayslipPdf({
          companyName,
          legalName,
          tagline,
          primaryColor,
          logoUrl,
          iconUrl,
          month,
          year,
          presetStyle,
          config,
          entry,
          allowFormulas: perms.allowFormulaAutoCalc,
          passwordProtect: perms.requirePdfPassword,
          passwordRule: perms.pdfPasswordRule,
        });
        const safeName = `${entry.employeeId}_${entry.name.replace(/[^a-zA-Z0-9]+/g, '_')}_${month}_${year}.pdf`;
        zip.file(safeName, pdfBuf);
      }

      const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
      const zipFilename = `Payslips_${(ws?.slug || 'company')}_${month}_${year}.zip`;

      return new NextResponse(new Uint8Array(zipBuf), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipFilename}"`,
        },
      });
    }

    if (mode === 'base64_batch') {
      const entries: PayrollSlipEntry[] = Array.isArray(body.entries) ? body.entries : [];
      const items = await Promise.all(
        entries.map(async (entry) => {
          const pdfBuf = await generateFormattedPayslipPdf({
            companyName,
            legalName,
            tagline,
            primaryColor,
            logoUrl,
            iconUrl,
            month,
            year,
            presetStyle,
            config,
            entry,
            allowFormulas: perms.allowFormulaAutoCalc,
            passwordProtect: perms.requirePdfPassword,
            passwordRule: perms.pdfPasswordRule,
          });
          return {
            employeeId: entry.employeeId,
            filename: `Payslip_${entry.employeeId}_${month}_${year}.pdf`,
            base64: pdfBuf.toString('base64'),
            size: pdfBuf.length,
          };
        })
      );
      return NextResponse.json({ success: true, files: items });
    }

    // Single PDF preview or download
    const entry: PayrollSlipEntry = body.entry || {
      employeeId: 'EMP001',
      name: 'Sample Employee',
      email: 'employee@company.com',
      department: 'Operations',
      designation: 'Senior Executive',
      location: 'Corporate Office',
      dateOfJoining: '01-Apr-2023',
      pan: 'ABCDE1234F',
      uan: '100987654321',
      bankName: 'HDFC Bank',
      bankAccount: 'XXXXXX4521',
      totalDays: 30,
      paidDays: 30,
      lopDays: 0,
      earnings: {
        basic: 30000,
        hra: 12000,
        conveyance: 1600,
        specialAllowance: 6400,
        bonus: 0,
      },
      deductions: {
        pfEmployee: 1800,
        esic: 0,
        pt: 200,
        tds: 1500,
        otherDeductions: 0,
      },
    };

    const pdfBuffer = await generateFormattedPayslipPdf({
      companyName,
      legalName,
      tagline,
      primaryColor,
      logoUrl,
      iconUrl,
      month,
      year,
      presetStyle,
      config,
      entry,
      allowFormulas: body.preview ? true : perms.allowFormulaAutoCalc,
      passwordProtect: body.preview ? false : perms.requirePdfPassword,
      passwordRule: perms.pdfPasswordRule,
    });

    const filename = `Payslip_${entry.employeeId}_${month}_${year}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${body.download ? 'attachment' : 'inline'}; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to generate payslip PDF' },
      { status: 500 }
    );
  }
}
