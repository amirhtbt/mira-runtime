<?php
declare(strict_types=1);

final class Test
{
    private static int $count = 0;

    public static function run(string $name, callable $test): void
    {
        self::$count++;
        try {
            $test();
            echo "PASS {$name}\n";
        } catch (Throwable $exception) {
            fwrite(STDERR, "FAIL {$name}: {$exception->getMessage()}\n");
            exit(1);
        }
    }

    public static function assert(bool $condition, string $message = 'assertion failed'): void
    {
        if (!$condition) throw new RuntimeException($message);
    }

    public static function equals(mixed $expected, mixed $actual, string $message = ''): void
    {
        if ($expected !== $actual) {
            throw new RuntimeException($message !== '' ? $message : 'Expected ' . var_export($expected, true) . ' got ' . var_export($actual, true));
        }
    }

    public static function throws(callable $fn, string $class, ?string $reason = null): void
    {
        try {
            $fn();
        } catch (Throwable $exception) {
            if (!$exception instanceof $class) throw new RuntimeException('Unexpected exception ' . get_class($exception));
            if ($reason !== null && (!property_exists($exception, 'reason') || $exception->reason !== $reason)) {
                throw new RuntimeException('Unexpected exception reason');
            }
            return;
        }
        throw new RuntimeException('Expected exception was not thrown');
    }
}
