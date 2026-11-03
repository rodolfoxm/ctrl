// C# helper compiled by PowerShell (Add-Type) for the Batuta engine. Only scheduling and memory-list
// APIs, the same family Process Lasso uses: no handle ever asks for VM_READ/VM_WRITE, nothing is
// injected, and games are only touched through the scheduler (priority, affinity, I/O, GPU, power).
module.exports = String.raw`
using System;
using System.Runtime.InteropServices;

public static class BatutaNative {
  const uint SET_INFO = 0x0200, QUERY_LIMITED = 0x1000;

  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("ntdll.dll")] static extern int NtSetInformationProcess(IntPtr h, int cls, ref int value, int len);
  [DllImport("ntdll.dll")] static extern int NtQuerySystemInformation(int cls, IntPtr buf, int len, out int ret);
  [DllImport("ntdll.dll")] static extern int NtSetSystemInformation(int cls, ref int value, int len);
  [DllImport("ntdll.dll")] static extern int RtlAdjustPrivilege(int priv, bool enable, bool thread, out bool was);
  [DllImport("gdi32.dll")] static extern int D3DKMTSetProcessSchedulingPriorityClass(IntPtr h, int cls);
  [StructLayout(LayoutKind.Sequential)] struct THROTTLE { public uint Version; public uint ControlMask; public uint StateMask; }
  [DllImport("kernel32.dll")] static extern bool SetProcessInformation(IntPtr h, int cls, ref THROTTLE info, int size);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [StructLayout(LayoutKind.Sequential)] struct LASTINPUT { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUT li);
  [DllImport("kernel32.dll")] static extern bool GetSystemCpuSetInformation(IntPtr buf, uint len, out uint ret, IntPtr proc, uint flags);

  static bool With(int pid, uint access, Func<IntPtr, bool> fn) {
    IntPtr h = OpenProcess(access, false, pid);
    if (h == IntPtr.Zero) return false;
    try { return fn(h); } finally { CloseHandle(h); }
  }

  // 0 very low, 1 low, 2 normal (Windows has no "high" I/O for user processes).
  public static bool IoPriority(int pid, int level) {
    return With(pid, SET_INFO, h => NtSetInformationProcess(h, 33, ref level, 4) == 0);
  }

  // D3DKMT_SCHEDULINGPRIORITYCLASS: 0 idle, 1 below normal, 2 normal, 3 above normal, 4 high.
  public static bool GpuPriority(int pid, int cls) {
    return With(pid, SET_INFO | QUERY_LIMITED, h => D3DKMTSetProcessSchedulingPriorityClass(h, cls) == 0);
  }

  // 0 let Windows decide, 1 never throttle (opt out of EcoQoS/efficiency mode), 2 always throttle.
  public static bool Efficiency(int pid, int mode) {
    THROTTLE t = new THROTTLE();
    t.Version = 1;
    t.ControlMask = mode == 0 ? 0u : 1u;
    t.StateMask = mode == 2 ? 1u : 0u;
    return With(pid, SET_INFO, h => SetProcessInformation(h, 4, ref t, 12));
  }

  public static int ForegroundPid() {
    uint pid;
    GetWindowThreadProcessId(GetForegroundWindow(), out pid);
    return (int)pid;
  }

  public static long IdleMs() {
    LASTINPUT li = new LASTINPUT();
    li.cbSize = 8;
    if (!GetLastInputInfo(ref li)) return 0;
    return (long)(uint)((uint)Environment.TickCount - li.dwTime);
  }

  static void Privilege() { bool was; RtlAdjustPrivilege(13, true, false, out was); } // SeProfileSingleProcessPrivilege

  // [standby pages, free + zeroed pages], from SYSTEM_MEMORY_LIST_INFORMATION (class 80).
  public static long[] MemoryList() {
    Privilege();
    int size = 22 * IntPtr.Size, ret;
    IntPtr buf = Marshal.AllocHGlobal(size);
    try {
      if (NtQuerySystemInformation(80, buf, size, out ret) != 0) return new long[] { -1, -1 };
      long zero = Marshal.ReadIntPtr(buf, 0).ToInt64(), free = Marshal.ReadIntPtr(buf, IntPtr.Size).ToInt64(), standby = 0;
      for (int i = 0; i < 8; i++) standby += Marshal.ReadIntPtr(buf, (5 + i) * IntPtr.Size).ToInt64();
      return new long[] { standby, zero + free };
    } finally { Marshal.FreeHGlobal(buf); }
  }

  public static bool PurgeStandby() {
    Privilege();
    int cmd = 4; // MemoryPurgeStandbyList
    return NtSetSystemInformation(80, ref cmd, 4) == 0;
  }

  // [P-core mask, E-core mask] for processor group 0, from the CPU set efficiency classes.
  public static long[] CoreMasks() {
    uint len;
    GetSystemCpuSetInformation(IntPtr.Zero, 0, out len, IntPtr.Zero, 0);
    IntPtr buf = Marshal.AllocHGlobal((int)len);
    try {
      if (!GetSystemCpuSetInformation(buf, len, out len, IntPtr.Zero, 0)) return new long[] { 0, 0 };
      int max = 0, off = 0;
      var items = new System.Collections.Generic.List<int[]>();
      while (off < len) {
        int size = Marshal.ReadInt32(buf, off);
        if (size <= 0) break;
        int group = Marshal.ReadInt16(buf, off + 12), lp = Marshal.ReadByte(buf, off + 14), eff = Marshal.ReadByte(buf, off + 18);
        if (group == 0 && lp < 64) { items.Add(new int[] { lp, eff }); if (eff > max) max = eff; }
        off += size;
      }
      long p = 0, e = 0;
      foreach (var it in items) { if (it[1] == max) p |= 1L << it[0]; else e |= 1L << it[0]; }
      return new long[] { p, e };
    } finally { Marshal.FreeHGlobal(buf); }
  }
}
`;
