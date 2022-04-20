import { expect } from "chai";
import { validateEnv } from "../../src/env.js";

describe("Environment variables", () => {
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