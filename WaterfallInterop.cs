namespace RTLSDRWaterfall.Blazor;

using Microsoft.JSInterop;

public class WaterfallInterop : IAsyncDisposable
{
    private readonly Lazy<Task<IJSObjectReference>> jsModule;

    public WaterfallInterop(IJSRuntime js)
    {
        const string jsBundle = "./_content/RTLSDRWaterfall.Blazor/js/index.bundle.js";
        jsModule = new Lazy<Task<IJSObjectReference>>(() => js.InvokeAsync<IJSObjectReference>(
            "import", jsBundle).AsTask());
    }

    public async Task DisplayRTLPowerData(string message)
    {
        var module = await jsModule.Value;
        await module.InvokeVoidAsync("let test = new Waterfall('waterfall'', '', '', true, true, true)");
    }

    public async ValueTask DisposeAsync()
    {
        if (jsModule.IsValueCreated)
        {
            var module = await jsModule.Value;
            await module.DisposeAsync();
        }
    }
}