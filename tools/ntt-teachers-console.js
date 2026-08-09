/**
 * Chạy file này trong Chrome DevTools > Sources > Snippets khi đang mở:
 * https://phongdaotao.ntt.edu.vn/dang-ky-hoc-phan.html
 *
 * Script dùng session của tab hiện tại, không lưu Cookie vào source.
 */
(async () => {
  "use strict";

  const config = {
    idDotDangKy: "64",
    maMonHoc: "078520",
    dsHocPhanDuocHoc: "0101078520,0110078520,0123078520,0124078520",
    isLhpKhongTrungLich: "true",
    loaiDkhp: "1",
    maMonCha: "",
    concurrency: 4,
    maxAttempts: 5,
    retryBaseDelayMs: 1000,
    retryMaxDelayMs: 30000,
    requestTimeoutMs: 30000,
    downloadJson: true,
  };

  const baseUrl = location.origin;
  if (baseUrl !== "https://phongdaotao.ntt.edu.vn") {
    throw new Error(
      "Hãy chạy script trên tab https://phongdaotao.ntt.edu.vn/dang-ky-hoc-phan.html",
    );
  }

  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const cleanText = (value) => value.replace(/\s+/g, " ").trim();
  const teacherLabel = /^(giang vien|giao vien|gv|can bo giang day)(\s*[:：])?$/i;
  const looksLikeLoginPage = (html) =>
    /type=["']password["']/i.test(html) ||
    /(?:dang[- ]?nhap|login)/i.test(html.slice(0, 2500));
  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  function isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  function retryDelay(response, attempt) {
    const retryAfter = response?.headers.get("Retry-After");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const milliseconds = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(retryAfter) - Date.now();
      if (Number.isFinite(milliseconds) && milliseconds > 0) {
        return Math.min(milliseconds, config.retryMaxDelayMs);
      }
    }

    const exponential = config.retryBaseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.random() * config.retryBaseDelayMs;
    return Math.min(exponential + jitter, config.retryMaxDelayMs);
  }

  async function post(path, fields) {
    const body = new URLSearchParams();
    Object.entries(fields).forEach(([key, value]) => {
      body.set(`param[${key}]`, String(value));
    });

    for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        config.requestTimeoutMs,
      );
      let response;

      try {
        response = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "text/html, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
          },
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          const retryable = isRetryableStatus(response.status);
          if (!retryable || attempt === config.maxAttempts) {
            throw new Error(
              `${path}: HTTP ${response.status} sau ${attempt} lần gọi`,
            );
          }

          const delay = retryDelay(response, attempt);
          console.warn(
            `${path}: HTTP ${response.status}; thử lại ${attempt + 1}/${config.maxAttempts} sau ${Math.round(delay)}ms`,
          );
          await sleep(delay);
          continue;
        }

        const html = await response.text();
        if (looksLikeLoginPage(html)) {
          throw new Error(
            "Phiên đăng nhập đã hết hạn; hãy đăng nhập lại rồi chạy lại script.",
          );
        }
        return html;
      } catch (error) {
        const isHttpError = /: HTTP \d+/.test(error?.message || "");
        const isAuthError = /Phiên đăng nhập đã hết hạn/.test(error?.message || "");
        if (isHttpError || isAuthError || attempt === config.maxAttempts) {
          throw error;
        }

        const delay = retryDelay(response, attempt);
        const reason = error?.name === "AbortError"
          ? `timeout ${config.requestTimeoutMs}ms`
          : error?.message || String(error);
        console.warn(
          `${path}: ${reason}; thử lại ${attempt + 1}/${config.maxAttempts} sau ${Math.round(delay)}ms`,
        );
        await sleep(delay);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw new Error(`${path}: không thể hoàn thành request`);
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  function rowCells(row) {
    return [...row.querySelectorAll(":scope > th, :scope > td")]
      .map((cell) => cleanText(cell.textContent || ""))
      .filter(Boolean);
  }

  function parseClasses(html) {
    const doc = parseHtml(html);
    const seen = new Set();

    return [...doc.querySelectorAll("[data-guidlhp]")]
      .map((element) => {
        const guid = element.getAttribute("data-guidlhp")?.trim();
        if (!guid || seen.has(guid)) return null;
        seen.add(guid);

        const row = element.closest("tr");
        return {
          guid,
          listRow: row ? rowCells(row) : [cleanText(element.textContent || "")],
          attributes: Object.fromEntries(
            [...element.attributes]
              .filter(({ name }) => name.startsWith("data-"))
              .map(({ name, value }) => [name, value]),
          ),
        };
      })
      .filter(Boolean);
  }

  function parseDetail(html) {
    const doc = parseHtml(html);
    const tables = [...doc.querySelectorAll("table")];
    const detailRows = [...doc.querySelectorAll("tr")]
      .map(rowCells)
      .filter((cells) => cells.length > 0);
    const teachers = [];

    // Dạng bảng: tìm cột có tiêu đề "Giảng viên" rồi lấy các ô cùng cột.
    for (const table of tables) {
      const rows = [...table.querySelectorAll("tr")].map(rowCells);
      rows.forEach((cells, headerIndex) => {
        const teacherIndexes = cells
          .map((cell, index) => (teacherLabel.test(normalize(cell)) ? index : -1))
          .filter((index) => index >= 0);

        for (const teacherIndex of teacherIndexes) {
          for (const dataRow of rows.slice(headerIndex + 1)) {
            if (dataRow[teacherIndex]) teachers.push(dataRow[teacherIndex]);
          }
        }
      });
    }

    // Dạng key/value: "Giảng viên | Nguyễn Văn A".
    for (const cells of detailRows) {
      const labelIndex = cells.findIndex((cell) => teacherLabel.test(normalize(cell)));
      if (labelIndex >= 0 && cells[labelIndex + 1]) {
        teachers.push(cells[labelIndex + 1]);
      }
    }

    // Dạng một ô: "Giảng viên: Nguyễn Văn A".
    const inlinePattern = /^(?:Giảng\s*viên|Giáo\s*viên|GV)\s*[:：]\s*(.+)$/iu;
    for (const cell of doc.querySelectorAll("th, td, label, p, li")) {
      const match = cleanText(cell.textContent || "").match(inlinePattern);
      if (match) teachers.push(cleanText(match[1]));
    }

    const uniqueTeachers = [...new Map(
      teachers
        .map(cleanText)
        .filter((value) => value && !teacherLabel.test(normalize(value)))
        .map((value) => [normalize(value), value]),
    ).values()];

    return { teachers: uniqueTeachers, detailRows };
  }

  async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function run() {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        try {
          results[index] = await worker(items[index], index);
        } catch (error) {
          results[index] = {
            ...items[index],
            teachers: [],
            detailRows: [],
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, () => run()),
    );
    return results;
  }

  const listHtml = await post("/SinhVienDangKy/LopHocPhanChoDangKy", {
    IDDotDangKy: config.idDotDangKy,
    MaMonHoc: config.maMonHoc,
    DSHocPhanDuocHoc: config.dsHocPhanDuocHoc,
    IsLHPKhongTrungLich: config.isLhpKhongTrungLich,
    LoaiDKHP: config.loaiDkhp,
    MaMonCha: config.maMonCha,
  });
  const classes = parseClasses(listHtml);

  if (classes.length === 0) {
    throw new Error("Response danh sách lớp không chứa phần tử data-guidlhp.");
  }

  const classDetails = await mapWithConcurrency(
    classes,
    config.concurrency,
    async (classInfo, index) => {
      console.log(`Đang lấy chi tiết ${index + 1}/${classes.length}:`, classInfo.guid);
      const detailHtml = await post(
        "/SinhVienDangKy/ChiTietLopHocPhanChoDangKy",
        { GuidIDLopHocPhan: classInfo.guid, MaMonCha: config.maMonCha },
      );
      return { ...classInfo, ...parseDetail(detailHtml) };
    },
  );

  const teacherNames = [...new Map(
    classDetails
      .flatMap(({ teachers }) => teachers)
      .map((name) => [normalize(name), name]),
  ).values()];
  const result = {
    generatedAt: new Date().toISOString(),
    course: config.maMonHoc,
    teacherNames,
    classes: classDetails,
  };

  console.table(
    classDetails.flatMap((item) =>
      (item.teachers.length ? item.teachers : [""]).map((teacher) => ({
        guid: item.guid,
        teacher,
        class: item.listRow.join(" | "),
        error: item.error || "",
      })),
    ),
  );
  console.log("Kết quả đầy đủ:", result);

  if (config.downloadJson) {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ntt-teachers-${config.maMonHoc}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  return result;
})();
