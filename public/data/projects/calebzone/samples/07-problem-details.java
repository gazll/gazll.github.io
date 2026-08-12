package com.calebzone.core.exception;

import com.calebzone.core.exception.error.BaseErrorCode;
import com.calebzone.core.exception.error.ErrorCode;
import com.calebzone.core.exception.error.ErrorDetail;
import jakarta.validation.ConstraintViolationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.coyote.BadRequestException;
import org.jspecify.annotations.Nullable;
import org.slf4j.MDC;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
//@Order(Ordered.HIGHEST_PRECEDENCE)
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {
    public static final String TRACE_ID_PARAM = "traceId";
    public static final String ERROR_PARAM = "error";
    public static final String FIELD_ERROR_PARAM = "fieldErrors";
    private final MessageSource messageSource;

    protected String resolveMessage(String code, String defaultMessage, Object... args) {
        return messageSource.getMessage(code, args, defaultMessage, LocaleContextHolder.getLocale());
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
                                                                  HttpHeaders headers,
                                                                  HttpStatusCode status,
                                                                  WebRequest request) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(status);

        problemDetail.setProperty(ERROR_PARAM, this.toErrorDetail(ErrorCode.REQUEST_VALIDATION_ERROR));
        problemDetail.setProperty(FIELD_ERROR_PARAM, this.buildValidationErrors(ex.getBindingResult()));

        return this.handleExceptionInternal(ex, problemDetail, headers, status, request);
    }

    private ErrorDetail toErrorDetail(BaseErrorCode errorCode, Object... args) {
        return ErrorDetail.builder()
            .code(errorCode.getCode())
            .category(errorCode.getCategory().name())
            .message(this.resolveMessage(errorCode.getCode(), null, args))
            .build();
    }

    protected List<ErrorDetail> buildValidationErrors(BindingResult bindingResult) {
        return bindingResult.getAllErrors().stream()
            .map(objectError -> ErrorDetail.builder()
                .field(objectError instanceof FieldError fieldError ? fieldError.getField() : objectError.getObjectName())
                .code(objectError.getCode())
                .message(this.resolveMessage(objectError.getCode(), null, objectError.getArguments()))
                .build())
            .toList();
    }

    @Override
    protected @Nullable ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        if (statusCode.is5xxServerError()) {
            log.error("System Exception ({}): ", statusCode.value(), ex);
        } else if (log.isDebugEnabled()) {
            log.debug("Client Error ({}): {}", statusCode.value(), ex.getMessage());
        }
        return super.handleExceptionInternal(ex, body, headers, statusCode, request);
    }

    @ExceptionHandler(BaseException.class)
    public ResponseEntity<Object> handleBaseException(BaseException ex, WebRequest request) {
        BaseErrorCode errorCode = ex.getErrorCode();

        ProblemDetail body = ProblemDetail.forStatus(errorCode.getHttpStatus());
        body.setProperty(ERROR_PARAM, this.toErrorDetail(errorCode, ex.getArgs()));

        return this.handleExceptionInternal(ex, body, new HttpHeaders(), errorCode.getHttpStatus(), request);
    }

    @Override
    protected ResponseEntity<Object> createResponseEntity(@Nullable Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        if (body instanceof ProblemDetail problemDetail) {
            problemDetail.setType(null);
            problemDetail.setTitle(null);
            problemDetail.setProperty(TRACE_ID_PARAM, this.currentTraceId());
        }
        return super.createResponseEntity(body, headers, statusCode, request);
    }

    private String currentTraceId() {
        String traceId = MDC.get("traceId");
        return traceId != null ? traceId : UUID.randomUUID().toString();
    }
}

