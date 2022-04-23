import { expect } from "chai";
import { defaultAll, defaultEnv, parseEnv, validateEnv } from "../../src/env.js";

describe("Environment variables", () => {
    describe(defaultAll.name, () => {
        it('should correctly default all missing variables', () => {
            const env: { a?: number, q?: string; } = {};
            const defaulted = defaultAll(env, { a: 42, q: "unknown" });
            expect(defaulted.a).to.equal(42);
            expect(defaulted.q).to.equal("unknown");

        });
    });

    describe(defaultEnv.name, () => {
        it('should correctly default missing variables', () => {
            const env: { a: number, q?: string; } = { a: 42 };
            const defaulted = defaultEnv(env, "q", "unknown");
            expect(defaulted.q).to.equal("unknown");
        });

        it('should not override variables that are set', () => {
            const env: { a: number; } = { a: 42 };
            const defaulted = defaultEnv(env, "a", 24);
            expect(defaulted.a).to.equal(42);
        });
    });

    describe(parseEnv.name, () => {
        it('should correctly parse variables', () => {
            type TestEnv = {
                answer: number;
                questionKnown: boolean;
                answerExists: boolean;
            };

            const env: Record<keyof TestEnv, string> = {
                answer: "42",
                questionKnown: "false",
                answerExists: "true"
            };

            const { answer, answerExists, questionKnown } = parseEnv<TestEnv>(env);
            expect(answer).to.equal(42);
            expect(answerExists).to.be.true;
            expect(questionKnown).to.be.false;
        });
    });

    describe(validateEnv.name, () => {
        it('should return false if any of the required variables are missing', () => {
            const status = validateEnv({});
            expect(status).to.be.false;
        });

        it('should return true if all required variables are present', () => {
            const status = validateEnv({
                TENK_EMAIL: "tenk@so.com",
                TENK_PASSWORD: "ab42$_",
                CHAT_EMAIL: "test@tester.org",
                CHAT_PASSWORD: "42",
                CHAT_ROOM: "123"
            });
            expect(status).to.be.true;
        });
    });
});