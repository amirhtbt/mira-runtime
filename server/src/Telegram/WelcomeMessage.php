<?php
declare(strict_types=1);

namespace Tinv\Telegram;

final class WelcomeMessage
{
    /** @param array<string, mixed> $update
     *  @return array<string, mixed>|null
     */
    public static function forUpdate(array $update, string $origin): ?array
    {
        $message = $update['message'] ?? null;
        if (!is_array($message) || !is_array($message['chat'] ?? null)) {
            return null;
        }
        $chat = $message['chat'];
        if (($chat['type'] ?? null) !== 'private' || !is_int($chat['id'] ?? null) || $chat['id'] <= 0) {
            return null;
        }
        if (!is_array($message['from'] ?? null) || ($message['from']['is_bot'] ?? false) === true) {
            return null;
        }
        if (($message['from']['id'] ?? null) !== $chat['id']) {
            return null;
        }
        $text = $message['text'] ?? null;
        if (!is_string($text) || !preg_match('/^\/start(?:@[A-Za-z0-9_]{5,32})?(?:\s+[A-Za-z0-9_-]{1,64})?$/D', $text)) {
            return null;
        }

        return [
            'method' => 'sendMessage',
            'chat_id' => $chat['id'],
            'text' => "به فاکتورساز بهار خوش آمدید 🌿\n\nفاکتور و پیش‌فاکتور حرفه‌ای بسازید، PDF دریافت کنید و اسناد هر مشتری را یک‌جا نگه دارید.\n\nبرای شروع، دکمهٔ زیر را بزنید.",
            'reply_markup' => [
                'inline_keyboard' => [[
                    ['text' => 'ساخت فاکتور و پیش‌فاکتور', 'web_app' => ['url' => $origin]],
                ]],
            ],
        ];
    }
}
