-- KEYS[1]: {session:<sessionId>}:seeded_tasks (Redis Hash маркеров задач)
-- KEYS[2]: {session:<sessionId>}:task:<taskKey>:updates (Redis Stream конкретной задачи)
-- ARGV[1]: task_key (строка вида "<taskId>:<lang>")
-- ARGV[2]: base64_starter_update (Yjs update со стартовым кодом)
-- ARGV[3]: ttl_seconds (например, 86400)

local has_marker = (redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1)
local stream_exists = (redis.call('EXISTS', KEYS[2]) == 1)
local stream_len = 0
if stream_exists then
    stream_len = redis.call('XLEN', KEYS[2])
end

-- =========================================================================
-- СЛУЧАЙ 1: marker есть, Stream существует и содержит данные (stream_len > 0)
-- Штатное валидное состояние. Документ засеян, стрим активен.
-- =========================================================================
if has_marker and stream_len > 0 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
    return 0 -- No-op: уже засеяно и валидно
end

-- =========================================================================
-- СЛУЧАЙ 2: marker есть, но Stream отсутствует (истек по TTL или удален)
-- СЛУЧАЙ 3: marker есть, но Stream существует и пуст (аномальное состояние)
-- СЛУЧАЙ 5: marker отсутствует и Stream отсутствует/пуст (первичный сидинг)
-- =========================================================================
if (not stream_exists) or (stream_len == 0) then
    -- В случаях 2, 3 и 5 стрим пуст или отсутствует.
    -- АТОМАРНО записываем стартовую дельту в Stream через pcall:
    local ok_xadd, err_or_id = pcall(redis.call, 'XADD', KEYS[2], '*', 'data', ARGV[2])
    if not ok_xadd then
        return redis.error_reply("ERR_XADD_FAILED: " .. tostring(err_or_id))
    end

    -- Фиксируем/подтверждаем маркер задачи в хэше:
    local ok_hset, err_hset = pcall(redis.call, 'HSET', KEYS[1], ARGV[1], '1')
    if not ok_hset then
        return redis.error_reply("ERR_HSET_FAILED: " .. tostring(err_hset))
    end

    -- Синхронно продлеваем TTL для обоих ключей слота:
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))

    if has_marker then
        -- Случаи 2 и 3: восстанавливается ТОЛЬКО служебная структура стрима со стартовым шаблоном.
        -- Пользовательские правки, находившиеся в истекшем стриме, НЕ восстанавливаются.
        return 3
    else
        return 1 -- Случай 5: первичный сидинг успешно выполнен
    end
end

-- =========================================================================
-- СЛУЧАЙ 4: marker отсутствует, но Stream существует и содержит данные (stream_len > 0)
-- Рассинхронизация: хэш маркеров истек, либо HSET упал в прошлом вызове.
-- =========================================================================
if (not has_marker) and (stream_len > 0) then
    -- Повторный XADD категорически запрещен, чтобы не продублировать стартовый код!
    -- Атомарно восстанавливаем маркер в хэше и синхронизируем TTL:
    local ok_hset, err_hset = pcall(redis.call, 'HSET', KEYS[1], ARGV[1], '1')
    if not ok_hset then
        return redis.error_reply("ERR_HSET_FAILED: " .. tostring(err_hset))
    end

    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
    return 2 -- Маркер успешно восстановлен без повторного XADD
end

return 0
