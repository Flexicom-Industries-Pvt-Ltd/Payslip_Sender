import { NextRequest, NextResponse } from 'next/server';
import { createEmployee, getEmployeesWithMonthlyStatus } from '@/lib/db-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const department = searchParams.get('department') || undefined;
    const month = searchParams.get('month') || undefined;
    const year = searchParams.get('year') || undefined;
    const statusFilter = (searchParams.get('statusFilter') as any) || undefined;

    const data = await getEmployeesWithMonthlyStatus({
      search,
      department,
      month,
      year,
      statusFilter,
    });

    return NextResponse.json({
      success: true,
      employees: data.employees,
      counts: data.counts,
      month: data.month,
      year: data.year,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, name, email, department } = body;

    if (!employeeId || !employeeId.trim()) {
      return NextResponse.json(
        { success: false, error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Employee Name is required' },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'A valid Email Address is required' },
        { status: 400 }
      );
    }

    const employee = await createEmployee({
      employeeId,
      name,
      email,
      department,
    });

    return NextResponse.json({ success: true, employee }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create employee' },
      { status: 400 }
    );
  }
}
