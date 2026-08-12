package com.calebzone.gateway.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;

/**
 * Gateway Routes Configuration
 * Defines all routes to downstream microservices
 */
@Slf4j
@Configuration
public class GatewayRoutesConfig {

    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
            // Auth Service Routes - Public and Protected
            .route("auth-service-public", r -> r
                .path("/auth/api/login", "/auth/api/register", "/auth/api/users/login", "/auth/api/users", "/auth/api/profiles/**")
                .and()
                .method(HttpMethod.POST, HttpMethod.GET)
                .filters(f -> f
                    .addRequestHeader("X-Gateway-Request", "true")
                    .addResponseHeader("X-Gateway-Response", "true")
                    .retry(config -> config.setRetries(2))
                )
                .uri("http://localhost:8081")
            )
            .route("auth-service-protected", r -> r
                .path("/auth/api/**")
                .filters(f -> f
                    .addRequestHeader("X-Gateway-Request", "true")
                    .addResponseHeader("X-Gateway-Response", "true")
                    .retry(config -> config.setRetries(2))
                    .circuitBreaker(config -> config
                        .setName("auth-service-cb")
                        .setFallbackUri("forward:/fallback/auth-service"))
                )
                .uri("http://localhost:8081")
            )

            // Air Service Routes
            .route("air-service", r -> r
                .path("/air/api/**")
                .filters(f -> f
                    .stripPrefix(0)
                    .addRequestHeader("X-Gateway-Request", "true")
                    .addResponseHeader("X-Gateway-Response", "true")
                    .retry(config -> config.setRetries(2))
                    .circuitBreaker(config -> config
                        .setName("air-service-cb")
                        .setFallbackUri("forward:/fallback/air-service"))
                )
                .uri("http://localhost:8082")
            )

            // AI Recognition Service Routes
            .route("ai-recognition-service", r -> r
                .path("/ai/api/**")
                .filters(f -> f
                    .stripPrefix(0)
                    .addRequestHeader("X-Gateway-Request", "true")
                    .addResponseHeader("X-Gateway-Response", "true")
                    .retry(config -> config.setRetries(2))
                    .circuitBreaker(config -> config
                        .setName("ai-service-cb")
                        .setFallbackUri("forward:/fallback/ai-service"))
                )
                .uri("http://localhost:8083")
            )

            // Gateway own endpoints
            .route("gateway-health", r -> r
                .path("/gateway/**")
                .filters(f -> f
                    .addRequestHeader("X-Gateway-Request", "true")
                )
                .uri("forward:/gateway")
            )

            // Fallback route for undefined paths
            .route("fallback-route", r -> r
                .path("/**")
                .filters(f -> f
                    .setStatus(404)
                )
                .uri("no://op")
            )
            .build();
    }
}

