<?php
declare(strict_types=1);

namespace Tinv\Telegram;

final class OwnerLaunchMessage
{
    /** @param array<string,mixed> $update
     * @return array<string,mixed>|null
     */
    public static function forUpdate(array $update, string $origin, string $configuredId): ?array
    {
        if (!preg_match('/^[1-9][0-9]{0,19}$/D', $configuredId)) return null;
        $message = $update['message'] ?? null;
        if (!is_array($message) || !is_array($message['chat'] ?? null) || !is_array($message['from'] ?? null)) return null;
        $chat = $message['chat']; $from = $message['from'];
        if (($chat['type'] ?? null) !== 'private' || ($from['is_bot'] ?? false) === true ||
            (string) ($chat['id'] ?? '') !== $configuredId || (string) ($from['id'] ?? '') !== $configuredId ||
            !preg_match('/^\/stats(?:@[A-Za-z0-9_]{5,32})?$/D', (string) ($message['text'] ?? ''))) return null;
        return [
            'method' => 'sendMessage',
            'chat_id' => $chat['id'],
            'text' => 'گزارش مدیریتی فقط‌خواندنی آماده است. برای مشاهدهٔ آمار، دکمهٔ زیر را بزنید.',
            'reply_markup' => ['inline_keyboard' => [[['text' => 'نمایش آمار برنامه', 'web_app' => ['url' => $origin . '/?owner=1']]]]],
        ];
    }
}
