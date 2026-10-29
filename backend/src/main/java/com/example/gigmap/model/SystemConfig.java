package com.example.gigmap.model;

import jakarta.persistence.*;

@Entity
@Table(name = "system_configs")
public class SystemConfig {
    @Id
    private String configKey = "COMMISSION_PERCENTAGE"; // Unique config key

    private Double configValue = 10.0; // Default commission rate

    public SystemConfig() {}

    public SystemConfig(String configKey, Double configValue) {
        this.configKey = configKey;
        this.configValue = configValue;
    }

    public String getConfigKey() {
        return configKey;
    }

    public void setConfigKey(String configKey) {
        this.configKey = configKey;
    }

    public Double getConfigValue() {
        return configValue;
    }

    public void setConfigValue(Double configValue) {
        this.configValue = configValue;
    }
}
