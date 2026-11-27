import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  checkWorkspacePermission,
  updateEmployee,
  deleteEmployee,
  getEmployeeById,
} from '@/lib/db-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = await checkWorkspacePermission(
      session.workspaceId,
      session.role,
      'allowEmployeeCrud'
    );
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Employee directory modifications are locked by Top Group Admin.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const employee = await getEmployeeById(id, session.workspaceId);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, employee });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = await checkWorkspacePermission(
      session.workspaceId,
      session.role,
      'allowEmployeeCrud'
    );
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Employee directory modifications are locked by Top Group Admin.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const {
      employeeId,
      name,
      email,
      department,
      designation,
      location,
      dateOfJoining,
      pan,
      uan,
      esicNo,
      bankName,
      bankAccount,
      ifscCode,
      salaryStructureJson,
    } = body;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const updated = await updateEmployee(
      id,
      {
        employeeId,
        name,
        email,
        department,
        designation,
        location,
        dateOfJoining,
        pan,
        uan,
        esicNo,
        bankName,
        bankAccount,
        ifscCode,
        salaryStructureJson,
      },
      session.workspaceId
    );

    return NextResponse.json({ success: true, employee: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update employee' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = await checkWorkspacePermission(
      session.workspaceId,
      session.role,
      'allowEmployeeCrud'
    );
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Employee directory modifications are locked by Top Group Admin.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const deleted = await deleteEmployee(id, session.workspaceId);
    return NextResponse.json({ success: true, employee: deleted });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete employee' },
      { status: 400 }
    );
  }
}
