
import { ScheduledEvent } from '../types';

/**
 * Checks if a value matches a CRON field
 * Supports: *, 5, 5-10, 5,10, * / 5
 */
function matchCronField(value: number, cronField: string): boolean {
    if (cronField === '*') return true;

    // Step values: */5
    if (cronField.includes('/')) {
        const [range, step] = cronField.split('/');
        // Treat * as 0-max for step purposes, but usually just checking modulo
        if (range === '*' || range === '0') {
            return value % parseInt(step) === 0;
        }
        // Complex ranges with steps (1-10/2) not strictly required for basic use but good to handle
        // Simplifying to standard step behavior
        return value % parseInt(step) === 0;
    }

    // Lists: 1,2,3
    if (cronField.includes(',')) {
        const parts = cronField.split(',');
        return parts.some(part => matchCronField(value, part));
    }

    // Ranges: 1-5
    if (cronField.includes('-')) {
        const [start, end] = cronField.split('-').map(Number);
        return value >= start && value <= end;
    }

    return value === parseInt(cronField);
}

/**
 * Validates if a CRON string matches a specific date
 * CRON Format: Minute Hour Day Month DayOfWeek
 * Allowed values:
 * Min: 0-59
 * Hour: 0-23
 * Day: 1-31
 * Month: 1-12
 * DoW: 0-6 (0 is Sunday)
 */
function checkCronMatch(cron: string, date: Date): boolean {
    try {
        const parts = cron.trim().split(/\s+/);
        if (parts.length !== 5) return false;

        const [min, hour, day, month, dow] = parts;

        const minutesMatch = matchCronField(date.getMinutes(), min);
        const hoursMatch = matchCronField(date.getHours(), hour);
        const dayMatch = matchCronField(date.getDate(), day);
        // JS Month is 0-11, CRON is 1-12
        const monthMatch = matchCronField(date.getMonth() + 1, month); 
        const dowMatch = matchCronField(date.getDay(), dow);

        return minutesMatch && hoursMatch && dayMatch && monthMatch && dowMatch;
    } catch (e) {
        console.error("Invalid CRON format:", cron);
        return false;
    }
}

export function shouldRunSchedule(event: ScheduledEvent, now: number, timezone: string): boolean {
    if (!event.active) return false;

    // Convert current time to the target timezone
    // We create a date string in the target timezone, then parse it back to get components
    // This allows us to "pretend" the date object is in that timezone
    const tzDateString = new Date(now).toLocaleString("en-US", { timeZone: timezone });
    const localDate = new Date(tzDateString);

    if (event.type === 'one_time') {
        const targetTime = new Date(event.schedule).getTime();
        
        // If the scheduled time has passed
        if (now >= targetTime) {
            // And we haven't run it yet (or run a long time ago, though one_time should deactivate after run)
            if (!event.lastRun) {
                return true;
            }
        }
        return false;
    }

    if (event.type === 'cron') {
        // Prevent running multiple times in the same minute
        if (event.lastRun) {
            const lastRunDate = new Date(event.lastRun).toLocaleString("en-US", { timeZone: timezone });
            const lastLocal = new Date(lastRunDate);
            
            // If we already ran this minute, skip
            if (lastLocal.getMinutes() === localDate.getMinutes() && 
                lastLocal.getHours() === localDate.getHours() && 
                lastLocal.getDate() === localDate.getDate()) {
                return false;
            }
        }

        return checkCronMatch(event.schedule, localDate);
    }

    return false;
}
