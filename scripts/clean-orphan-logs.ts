import { prisma } from '../src/lib/prisma';

async function main() {
  const employees = await prisma.employee.findMany();
  const logs = await prisma.emailDispatchLog.findMany();

  console.log(`Employees in DB: ${employees.length}`);
  console.log(`Logs in DB: ${logs.length}`);

  const validEmployeeIds = new Set(employees.map((e) => e.employeeId.toLowerCase()));
  const validEmails = new Set(employees.map((e) => e.email.toLowerCase()));

  // Find logs that do not correspond to any active employee
  const orphanLogs = logs.filter(
    (log) =>
      !validEmployeeIds.has(log.employeeId.toLowerCase()) &&
      !validEmails.has(log.email.toLowerCase())
  );

  console.log(`Found ${orphanLogs.length} orphan logs from deleted employees:`);
  for (const o of orphanLogs) {
    console.log(`- ${o.id}: ${o.employeeName} (${o.employeeId}) for ${o.month} ${o.year}`);
  }

  if (orphanLogs.length > 0) {
    const orphanIds = orphanLogs.map((o) => o.id);
    const deleteRes = await prisma.emailDispatchLog.deleteMany({
      where: {
        id: { in: orphanIds },
      },
    });
    console.log(`Cleaned up ${deleteRes.count} orphan dispatch logs.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
