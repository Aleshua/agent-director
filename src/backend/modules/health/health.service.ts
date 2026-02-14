import type { ApiResponse } from "@/backend/shared/types/api-response";

export type HealthStatus = {
    status: "ok";
    service: string;
};

export class HealthService {
    getStatus(): ApiResponse<HealthStatus> {
        return {
            data: {
                status: "ok",
                service: "agent-director-api",
            },
        };
    }
}
