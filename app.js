// ===== ตั้งค่า PDF.js Worker =====
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const PDF_PATH = 'certificate.pdf'; 
const TARGET_WIDTH = 794;
let activeRenderTasks = {};

// ===== โหลดและ Render PDF =====
async function loadPDF() {
  const pdfDoc = await pdfjsLib.getDocument(PDF_PATH).promise;
  await renderPage(pdfDoc, 1);
}

async function renderPage(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const baseScale = TARGET_WIDTH / viewport.width;

  const RENDER_SCALE = 3; 
  const scaledViewport = page.getViewport({ scale: baseScale * RENDER_SCALE });

  const canvas = document.getElementById(`pdf-canvas-${pageNum}`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  canvas.style.width = `${TARGET_WIDTH}px`;
  canvas.style.height = 'auto';

  if (activeRenderTasks[pageNum]) {
    await activeRenderTasks[pageNum].cancel();
  }
  const renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
  activeRenderTasks[pageNum] = renderTask;
  await renderTask.promise;
}

// 🌟 ฟังก์ชันจัดการความกว้างของ Input ตามข้อความที่พิมพ์สำหรับ inline-field
const autoResizeInput = (input) => {
  const span = document.createElement('span');
  const computedStyle = window.getComputedStyle(input);
  span.style.fontFamily = computedStyle.fontFamily || '"TH SarabunPSK", "TH Sarabun New"';
  span.style.fontSize = computedStyle.fontSize || '22px';
  span.style.fontWeight = computedStyle.fontWeight;
  span.style.fontStyle = computedStyle.fontStyle;
  span.style.letterSpacing = computedStyle.letterSpacing;
  span.style.visibility = 'hidden';
  span.style.whiteSpace = 'pre';
  span.style.position = 'absolute';
  span.textContent = input.value || input.getAttribute('placeholder') || ' ';
  document.body.appendChild(span);
  
  const newWidth = span.offsetWidth + 2; // เผื่อความกว้างเล็กน้อย
  input.style.width = newWidth + 'px';
  document.body.removeChild(span);
};

function initAutoResize() {
    document.querySelectorAll('.inline-field').forEach(input => {
        // ลบ listener เดิมออกก่อน (ถ้ามี)
        input.removeEventListener('input', handleResizeEvent);
        input.addEventListener('input', handleResizeEvent);
        setTimeout(() => autoResizeInput(input), 100);
    });
}

function handleResizeEvent(e) {
    autoResizeInput(e.target);
}

function getCommitteeStyles() {
    const advCount = parseInt(document.getElementById('advisorCount').value) || 1;
    const exmCount = parseInt(document.getElementById('examCount').value) || 1;
    const maxCount = Math.max(advCount, exmCount);
    
    if (maxCount >= 7) return { margin: '2px', line: '24px' };
    if (maxCount === 6) return { margin: '8px', line: '24px' };
    if (maxCount === 5) return { margin: '15px', line: '26px' };
    if (maxCount === 4) return { margin: '20px', line: '28px' };
    return { margin: '25px', line: '28px' };
}

function generateAdvisors() {
    const count = parseInt(document.getElementById('advisorCount').value) || 1;
    const container = document.getElementById('advisor-container');
    const styles = getCommitteeStyles();
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const role = (i === 0) ? "ประธานที่ปรึกษา" : "กรรมการที่ปรึกษา";
        container.innerHTML += `
            <div style="margin-bottom: ${styles.margin}; line-height: ${styles.line};">
                <div>(<input type="text" class="field inline-field text-center" value="" placeholder="ชื่อ-สกุล" style="width: 250px;">)</div>
                <div><input type="text" class="field inline-field text-center" value="${role}" style="width: 150px;"></div>
            </div>
        `;
    }
    initAutoResize();
}

function generateExam() {
    const count = parseInt(document.getElementById('examCount').value) || 1;
    const container = document.getElementById('exam-container');
    const styles = getCommitteeStyles();
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const role = (i === 0) ? "ประธานกรรมการ" : "กรรมการ";
        container.innerHTML += `
            <div style="margin-bottom: ${styles.margin}; line-height: ${styles.line};">
                <div>(<input type="text" class="field inline-field text-center" value="" placeholder="ชื่อ-สกุล" style="width: 250px;">)</div>
                <div><input type="text" class="field inline-field text-center" value="${role}" style="width: 150px;"></div>
            </div>
        `;
    }
    initAutoResize();
}

// ===== เมื่อเว็บโหลดเสร็จ =====
document.addEventListener('DOMContentLoaded', () => {
  loadPDF();
  initAutoResize();
  
  document.getElementById('advisorCount').addEventListener('change', () => { generateAdvisors(); generateExam(); });
  document.getElementById('examCount').addEventListener('change', () => { generateAdvisors(); generateExam(); });

  // Sync Document Type
  const docTypeSelect = document.getElementById('docTypeSelect');
  docTypeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      document.querySelectorAll('.doc-type-input').forEach(input => {
          input.value = val;
          autoResizeInput(input);
      });
  });
  docTypeSelect.dispatchEvent(new Event('change'));
  
  generateAdvisors();
  generateExam();

  // 5. Export PDF
  document.getElementById('btn-export').addEventListener('click', async () => {
    document.body.classList.add('exporting');
    const pageWrapper = document.getElementById('page1');
    pageWrapper.style.display = 'block';

    const EXPORT_SCALE = 3; 
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    try {
      const canvas = await html2canvas(pageWrapper, { 
        scale: EXPORT_SCALE, 
        useCORS: true, 
        logging: false,
        onclone: function (clonedDoc) {
          // เปลี่ยน input/select แบบพิมพ์ให้กลายเป็น div ธรรมดาตอนทำ PDF
          const inputs = clonedDoc.querySelectorAll('input, select');
          inputs.forEach(input => {
            if (input.tagName.toLowerCase() === 'input' && (input.type === 'radio' || input.type === 'checkbox' || input.type === 'hidden')) return;
            
            if (input.classList.contains('inline-field')) {
              const plainSpan = clonedDoc.createElement('span');
              plainSpan.innerText = input.value ? input.value : " ";
              if (input.classList.contains('bold-field')) {
                  plainSpan.style.fontWeight = 'bold';
                  plainSpan.style.fontSize = '27px';
              }
              if (input.classList.contains('bold-subfield')) {
                  plainSpan.style.fontWeight = 'bold';
                  plainSpan.style.fontSize = '24px';
              }
              plainSpan.className = 'text-center'; // keep centering
              input.parentNode.insertBefore(plainSpan, input);
              input.style.display = 'none';
              return;
            }
          });
          
          clonedDoc.querySelectorAll('.inline-flow-input').forEach(el => {
              el.style.setProperty('overflow', 'visible', 'important');
              el.style.setProperty('border', 'none', 'important');
          });
        }
      });
      
      const imgData = canvas.toDataURL('image/png'); 
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('Certificate_Form.pdf');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดตอน Export');
    } finally {
      document.body.classList.remove('exporting');
    }
  });
});
