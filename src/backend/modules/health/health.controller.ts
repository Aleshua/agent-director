import { HealthService } from "@/backend/modules/health/health.service";

export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    handleGetHealth() {
        return this.healthService.getStatus();
    }
}
