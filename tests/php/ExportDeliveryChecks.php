<?php
declare(strict_types=1);

use Tinv\Export\TemporaryExportFileService;

Test::run('G09 temporary export token is unguessable, type-checked and expiring', function () use ($pdo): void {
    $businessId = (string) $pdo->query('SELECT id FROM businesses ORDER BY created_at LIMIT 1')->fetchColumn();
    Test::assert($businessId !== '');
    $customerId = 'f1000000-0000-4000-8000-000000000001';
    $documentId = 'f1000000-0000-4000-8000-000000000002';
    $now = gmdate('Y-m-d H:i:s');
    $pdo->prepare('INSERT INTO customers (id,business_id,display_name,phone,created_at,updated_at) VALUES (?,?,?,?,?,?)')->execute([$customerId,$businessId,'Export Test','09120000000',$now,$now]);
    $pdo->prepare("INSERT INTO sales_documents (id,business_id,customer_id,document_type,currency_unit,subtotal_base_unit,grand_total_base_unit,created_at,updated_at) VALUES (?,?,?,'invoice','rial',1000,1000,?,?)")->execute([$documentId,$businessId,$customerId,$now,$now]);

    $service = new TemporaryExportFileService($pdo);
    $pdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n";
    $stored = $service->store($businessId,$documentId,$pdf,'application/pdf','invoice-test.pdf');
    Test::assert((bool) preg_match('/^[a-f0-9]{64}$/', $stored['token']));
    $row = $service->fetch($stored['token']);
    Test::assert($row !== null);
    Test::equals('application/pdf',$row['mimeType']);
    Test::equals($pdf,$row['bytes']);
    Test::equals(null,$service->fetch(str_repeat('0',64)));
    Test::throws(fn() => $service->store($businessId,$documentId,$pdf,'image/png','wrong.png'), RuntimeException::class);

    $pdo->prepare('UPDATE temporary_export_files SET expires_at=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE token_hash=?')->execute([hash('sha256',$stored['token'],true)]);
    Test::equals(null,$service->fetch($stored['token']));
    $pdo->prepare('DELETE FROM sales_documents WHERE id=?')->execute([$documentId]);
    $pdo->prepare('DELETE FROM customers WHERE id=?')->execute([$customerId]);
});
