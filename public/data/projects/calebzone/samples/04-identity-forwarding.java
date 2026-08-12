package com.calebzone.gateway.filter.factory;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Filter to forward JWT token and user information to downstream services
 */
@Slf4j
@Component
public class AuthenticationFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        return ReactiveSecurityContextHolder.getContext()
            .flatMap(securityContext -> {
                Authentication authentication = securityContext.getAuthentication();

                if (authentication != null && authentication.isAuthenticated()
                    && authentication.getPrincipal() instanceof Jwt jwt) {

                    // Extract user information from JWT
                    String username = jwt.getClaimAsString("sub"); // Subject is typically the username
                    String userId = jwt.getClaimAsString("userId");
                    String email = jwt.getClaimAsString("email");

                    // Add headers for downstream services
                    ServerHttpRequest.Builder requestBuilder = exchange.getRequest().mutate()
                        .header("X-Auth-User", username != null ? username : "")
                        .header("X-Auth-Token", exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION));

                    if (userId != null) {
                        requestBuilder.header("X-Auth-User-Id", userId);
                    }
                    if (email != null) {
                        requestBuilder.header("X-Auth-Email", email);
                    }

                    log.debug("Forwarding request for user: {}, userId: {}", username, userId);

                    return chain.filter(exchange.mutate().request(requestBuilder.build()).build());
                }

                return chain.filter(exchange);
            })
            .onErrorResume(error -> {
                log.debug("No security context available, proceeding without authentication headers");
                return chain.filter(exchange);
            });
    }

    @Override
    public int getOrder() {
        return 0;
    }
}

